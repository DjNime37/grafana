// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type CreateGraphiteRequestBody struct {
	What string  `json:"what"`
	Data string  `json:"data"`
	When float64 `json:"when"`
	Tags any     `json:"tags"`
}

// NewCreateGraphiteRequestBody creates a new CreateGraphiteRequestBody object.
func NewCreateGraphiteRequestBody() *CreateGraphiteRequestBody {
	return &CreateGraphiteRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateGraphiteRequestBody.
func (CreateGraphiteRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.CreateGraphiteRequestBody"
}
