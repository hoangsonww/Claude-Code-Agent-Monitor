output "namespace" {
  description = "Namespace containing CCAM."
  value       = kubernetes_namespace_v1.ccam.metadata[0].name
}

output "release_name" {
  description = "Helm release name."
  value       = helm_release.ccam.name
}

output "application_url" {
  description = "Configured public URL, or the port-forward URL when no public route is enabled."
  value       = var.hostname != "" ? "https://${var.hostname}" : "http://127.0.0.1:4820"
}

output "port_forward_command" {
  description = "Local access command."
  value       = "kubectl -n ${var.namespace} port-forward svc/$(kubectl -n ${var.namespace} get svc -l app.kubernetes.io/name=agent-monitor -o jsonpath='{.items[0].metadata.name}') 4820:80"
}
