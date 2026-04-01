// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateGraphiteBody struct {
	Message string `json:"message"`
	Id      string `json:"id"`
}

// NewCreateGraphiteBody creates a new CreateGraphiteBody object.
func NewCreateGraphiteBody() *CreateGraphiteBody {
	return &CreateGraphiteBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateGraphiteBody.
func (CreateGraphiteBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.CreateGraphiteBody"
}
