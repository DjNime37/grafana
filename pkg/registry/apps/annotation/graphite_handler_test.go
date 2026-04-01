package annotation

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"testing"
	"time"

	authtypes "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
)

func TestGraphiteHandler(t *testing.T) {
	ctx := context.Background()
	namespace := "default"

	tests := []struct {
		name           string
		payload        GraphiteAnnotationCmd
		expectedStatus int
		expectedError  string
		validateResult func(t *testing.T, store Store, response GraphiteAnnotationResponse)
	}{
		{
			name: "creates annotation with full payload and array tags",
			payload: GraphiteAnnotationCmd{
				What: "Deployment",
				Data: "deployed v1.2.3 to production",
				When: 1467844481,
				Tags: []any{"deploy", "production"},
			},
			expectedStatus: http.StatusOK,
			validateResult: func(t *testing.T, store Store, response GraphiteAnnotationResponse) {
				// Verify the annotation was created
				assert.NotEmpty(t, response.ID)
				assert.Equal(t, "Graphite annotation added", response.Message)

				// Fetch it back from the store
				result, err := store.List(ctx, namespace, ListOptions{})
				require.NoError(t, err)
				require.Len(t, result.Items, 1)

				anno := result.Items[0]
				assert.Equal(t, "Deployment\ndeployed v1.2.3 to production", anno.Spec.Text)
				assert.Equal(t, int64(1467844481*1000), anno.Spec.Time) // converted to milliseconds
				assert.Equal(t, []string{"deploy", "production"}, anno.Spec.Tags)
				assert.Nil(t, anno.Spec.DashboardUID)
				assert.Nil(t, anno.Spec.PanelID)
			},
		},
		{
			name: "creates annotation with space-separated tags (legacy format)",
			payload: GraphiteAnnotationCmd{
				What: "Incident",
				Data: "database outage",
				When: 1467844500,
				Tags: "outage database critical",
			},
			expectedStatus: http.StatusOK,
			validateResult: func(t *testing.T, store Store, response GraphiteAnnotationResponse) {
				result, err := store.List(ctx, namespace, ListOptions{})
				require.NoError(t, err)
				require.Len(t, result.Items, 1)

				anno := result.Items[0]
				assert.Equal(t, "Incident\ndatabase outage", anno.Spec.Text)
				assert.Equal(t, []string{"outage", "database", "critical"}, anno.Spec.Tags)
			},
		},
		{
			name: "creates annotation with minimal payload (no when, no data, no tags)",
			payload: GraphiteAnnotationCmd{
				What: "Simple event",
			},
			expectedStatus: http.StatusOK,
			validateResult: func(t *testing.T, store Store, response GraphiteAnnotationResponse) {
				result, err := store.List(ctx, namespace, ListOptions{})
				require.NoError(t, err)
				require.Len(t, result.Items, 1)

				anno := result.Items[0]
				assert.Equal(t, "Simple event", anno.Spec.Text)
				assert.NotZero(t, anno.Spec.Time) // should be set to current time
				assert.Empty(t, anno.Spec.Tags)

				// Verify timestamp is recent (within last 5 seconds)
				now := time.Now().Unix() * 1000
				assert.InDelta(t, now, anno.Spec.Time, 5000)
			},
		},
		{
			name: "creates annotation with data but no tags",
			payload: GraphiteAnnotationCmd{
				What: "Release",
				Data: "version 2.0.0",
				When: 1467844600,
			},
			expectedStatus: http.StatusOK,
			validateResult: func(t *testing.T, store Store, response GraphiteAnnotationResponse) {
				result, err := store.List(ctx, namespace, ListOptions{})
				require.NoError(t, err)
				require.Len(t, result.Items, 1)

				anno := result.Items[0]
				assert.Equal(t, "Release\nversion 2.0.0", anno.Spec.Text)
				assert.Empty(t, anno.Spec.Tags)
			},
		},
		{
			name: "rejects annotation without what field",
			payload: GraphiteAnnotationCmd{
				Data: "some data",
				When: 1467844481,
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "what field should not be empty",
		},
		{
			name: "rejects annotation with invalid tags format",
			payload: GraphiteAnnotationCmd{
				What: "Event",
				Tags: 12345, // invalid: not string or array
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid tags format",
		},
		{
			name: "rejects annotation with non-string tags in array",
			payload: GraphiteAnnotationCmd{
				What: "Event",
				Tags: []any{"valid", 123, "another"}, // 123 is not a string
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid tags format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a fresh in-memory store for each test
			store := NewMemoryStore()
			handler := newGraphiteHandler(store)

			// Create the request
			body, err := json.Marshal(tt.payload)
			require.NoError(t, err)

			u := &url.URL{
				Scheme: "http",
				Host:   "localhost",
				Path:   "/apis/annotation.grafana.app/v0alpha1/namespaces/" + namespace + "/graphite",
			}

			// Create a response recorder
			w := &mockResponseWriter{
				header: make(http.Header),
				body:   &bytes.Buffer{},
			}

			// Create the CustomRouteRequest (simulating what the app SDK does)
			customReq := &app.CustomRouteRequest{
				ResourceIdentifier: resource.FullIdentifier{
					Namespace: namespace,
				},
				URL:    u,
				Method: http.MethodPost,
				Body:   io.NopCloser(bytes.NewReader(body)),
			}

			// Call the handler
			err = handler(ctx, w, customReq)
			require.NoError(t, err)

			// Check status code
			assert.Equal(t, tt.expectedStatus, w.code)

			if tt.expectedStatus == http.StatusOK {
				// Parse the response
				var response GraphiteAnnotationResponse
				err = json.Unmarshal(w.body.Bytes(), &response)
				require.NoError(t, err)

				// Run validation
				if tt.validateResult != nil {
					tt.validateResult(t, store, response)
				}
			} else {
				// Check error message
				var errorResponse map[string]string
				err = json.Unmarshal(w.body.Bytes(), &errorResponse)
				require.NoError(t, err)
				assert.Contains(t, errorResponse["error"], tt.expectedError)
			}
		})
	}
}

func TestGraphiteHandler_EndToEnd(t *testing.T) {
	// This test demonstrates the full flow:
	// 1. POST Graphite annotation
	// 2. GET list annotations to verify it was created
	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), metav1.NamespaceDefault)
	namespace := "default"

	// Create store
	store := NewMemoryStore()

	// Create handlers
	accessClient := &fakeAccessClient{fn: func(_ authtypes.CheckRequest) bool { return true }}
	graphiteHandler := newGraphiteHandler(store)
	searchHandler := newSearchHandler(store, accessClient)

	// Step 1: Create annotation via Graphite endpoint
	graphitePayload := GraphiteAnnotationCmd{
		What: "End-to-end test event",
		Data: "This was created via Graphite API",
		When: 1467844481,
		Tags: []any{"e2e", "test"},
	}

	body, err := json.Marshal(graphitePayload)
	require.NoError(t, err)

	postURL := &url.URL{
		Scheme: "http",
		Host:   "localhost",
		Path:   "/apis/annotation.grafana.app/v0alpha1/namespaces/" + namespace + "/graphite",
	}
	postW := &mockResponseWriter{
		header: make(http.Header),
		body:   &bytes.Buffer{},
	}

	postCustomReq := &app.CustomRouteRequest{
		ResourceIdentifier: resource.FullIdentifier{
			Namespace: namespace,
		},
		URL:    postURL,
		Method: http.MethodPost,
		Body:   io.NopCloser(bytes.NewReader(body)),
	}

	err = graphiteHandler(ctx, postW, postCustomReq)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, postW.code)

	var createResponse GraphiteAnnotationResponse
	err = json.Unmarshal(postW.body.Bytes(), &createResponse)
	require.NoError(t, err)
	assert.Equal(t, "Graphite annotation added", createResponse.Message)
	assert.NotEmpty(t, createResponse.ID)

	// Step 2: List annotations via search endpoint to verify it exists
	getURL := &url.URL{
		Scheme: "http",
		Host:   "localhost",
		Path:   "/apis/annotation.grafana.app/v0alpha1/namespaces/" + namespace + "/search",
	}
	getW := &mockResponseWriter{
		header: make(http.Header),
		body:   &bytes.Buffer{},
		code:   http.StatusOK, // default to OK if WriteHeader isn't called
	}

	getCustomReq := &app.CustomRouteRequest{
		ResourceIdentifier: resource.FullIdentifier{
			Namespace: namespace,
		},
		URL:    getURL,
		Method: http.MethodGet,
	}

	err = searchHandler(ctx, getW, getCustomReq)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, getW.code)

	var listResponse annotationV0.AnnotationList
	err = json.Unmarshal(getW.body.Bytes(), &listResponse)
	require.NoError(t, err)

	// Verify the annotation is in the list
	require.Len(t, listResponse.Items, 1)
	annotation := listResponse.Items[0]

	assert.Equal(t, createResponse.ID, annotation.Name)
	assert.Equal(t, "End-to-end test event\nThis was created via Graphite API", annotation.Spec.Text)
	assert.Equal(t, int64(1467844481*1000), annotation.Spec.Time)
	assert.Equal(t, []string{"e2e", "test"}, annotation.Spec.Tags)
	assert.Nil(t, annotation.Spec.DashboardUID)
	assert.Nil(t, annotation.Spec.PanelID)
}

func TestParseGraphiteTags(t *testing.T) {
	tests := []struct {
		name     string
		input    any
		expected []string
		wantErr  bool
	}{
		{
			name:     "nil tags",
			input:    nil,
			expected: []string{},
			wantErr:  false,
		},
		{
			name:     "empty string",
			input:    "",
			expected: []string{},
			wantErr:  false,
		},
		{
			name:     "space-separated string",
			input:    "tag1 tag2 tag3",
			expected: []string{"tag1", "tag2", "tag3"},
			wantErr:  false,
		},
		{
			name:     "array of strings",
			input:    []any{"tag1", "tag2", "tag3"},
			expected: []string{"tag1", "tag2", "tag3"},
			wantErr:  false,
		},
		{
			name:     "empty array",
			input:    []any{},
			expected: []string{},
			wantErr:  false,
		},
		{
			name:    "array with non-string",
			input:   []any{"tag1", 123},
			wantErr: true,
		},
		{
			name:    "unsupported type",
			input:   12345,
			wantErr: true,
		},
		{
			name:    "map type",
			input:   map[string]string{"tag": "value"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseGraphiteTags(tt.input)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestFormatGraphiteAnnotation(t *testing.T) {
	tests := []struct {
		name     string
		what     string
		data     string
		expected string
	}{
		{
			name:     "what and data",
			what:     "Event",
			data:     "Additional info",
			expected: "Event\nAdditional info",
		},
		{
			name:     "only what",
			what:     "Event",
			data:     "",
			expected: "Event",
		},
		{
			name:     "empty what and data",
			what:     "",
			data:     "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatGraphiteAnnotation(tt.what, tt.data)
			assert.Equal(t, tt.expected, result)
		})
	}
}
