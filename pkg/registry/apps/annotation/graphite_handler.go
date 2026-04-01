package annotation

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GraphiteAnnotationCmd represents the Graphite event format
type GraphiteAnnotationCmd struct {
	When int64  `json:"when"` // Unix timestamp in seconds (optional)
	What string `json:"what"` // Event description (required)
	Data string `json:"data"` // Additional context (optional)
	Tags any    `json:"tags"` // Array of strings OR space-separated string
}

// GraphiteAnnotationResponse represents the response after creating a Graphite annotation
type GraphiteAnnotationResponse struct {
	Message string `json:"message"`
	ID      string `json:"id"`
}

func newGraphiteHandler(store Store) func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	return func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
		namespace := request.ResourceIdentifier.Namespace

		// Parse the Graphite format request
		var cmd GraphiteAnnotationCmd
		if err := json.NewDecoder(request.Body).Decode(&cmd); err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(writer).Encode(map[string]string{
				"error": "bad request data",
			})
		}

		// Validate required field
		if cmd.What == "" {
			writer.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(writer).Encode(map[string]string{
				"error": "what field should not be empty",
			})
		}

		// Format text: concatenate what and data
		text := formatGraphiteAnnotation(cmd.What, cmd.Data)

		// Parse tags - support both array and space-separated string
		tagsArray, err := parseGraphiteTags(cmd.Tags)
		if err != nil {
			writer.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(writer).Encode(map[string]string{
				"error": fmt.Sprintf("invalid tags format: %v", err),
			})
		}

		// Convert timestamp: Graphite uses seconds, Grafana uses milliseconds
		// If when is not provided, use current time
		timestamp := cmd.When
		if timestamp == 0 {
			timestamp = time.Now().Unix()
		}
		timestampMs := timestamp * 1000

		// Create the annotation resource
		annotation := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				// Let the store generate the name
				Namespace: namespace,
			},
			Spec: annotationV0.AnnotationSpec{
				Text: text,
				Time: timestampMs,
				Tags: tagsArray,
				// Note: Graphite annotations are always organization-level
				// (no dashboardUID or panelID)
			},
		}

		// Save to store
		created, err := store.Create(ctx, annotation)
		if err != nil {
			writer.WriteHeader(http.StatusInternalServerError)
			return json.NewEncoder(writer).Encode(map[string]string{
				"error": fmt.Sprintf("failed to save Graphite annotation: %v", err),
			})
		}

		// Return response in Graphite-compatible format
		response := GraphiteAnnotationResponse{
			Message: "Graphite annotation added",
			ID:      created.Name,
		}

		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusOK)
		return json.NewEncoder(writer).Encode(response)
	}
}

func formatGraphiteAnnotation(what string, data string) string {
	text := what
	if data != "" {
		text = text + "\n" + data
	}
	return text
}

func parseGraphiteTags(tags any) ([]string, error) {
	if tags == nil {
		return []string{}, nil
	}

	switch t := tags.(type) {
	case string:
		// Support tags in prior to Graphite 0.10.0 format (string of tags separated by space)
		if t == "" {
			return []string{}, nil
		}
		return strings.Split(t, " "), nil
	case []any:
		// Modern format: array of strings
		tagsArray := make([]string, 0, len(t))
		for _, tag := range t {
			if tagStr, ok := tag.(string); ok {
				tagsArray = append(tagsArray, tagStr)
			} else {
				return nil, fmt.Errorf("tag should be a string, got %T", tag)
			}
		}
		return tagsArray, nil
	default:
		return nil, fmt.Errorf("unsupported tags format: %T", tags)
	}
}
