package auditing

import (
	"net/http"

	"github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/audit"
)

const AuditAnnotationInnermostServiceIdentity = "grafana.app/innermost-service-identity"

// HTTPInjectAuditAnnotationMiddleware extracts the innermost service identity from the request,
// and injects it into the k8s audit event context (used for audit log suppression).
func HTTPInjectAuditAnnotationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if authInfo, ok := types.AuthInfoFrom(ctx); ok {
			if svcIdentity := authInfo.GetInnermostServiceIdentity(); svcIdentity != "" {
				// Annotate the K8s audit event so the audit backend can make a decision based on it.
				audit.AddAuditAnnotation(ctx, AuditAnnotationInnermostServiceIdentity, svcIdentity)
			}
		}

		next.ServeHTTP(w, r)
	})
}
