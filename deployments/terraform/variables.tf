variable "kubeconfig_path" {
  description = "Path to the kubeconfig for an existing AWS, GCP, Azure, OCI, or other conformant Kubernetes cluster."
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "Optional kubeconfig context. Leave empty to use the current context."
  type        = string
  default     = ""
}

variable "namespace" {
  description = "Namespace for CCAM."
  type        = string
  default     = "agent-monitor"
}

variable "release_name" {
  description = "Helm release name."
  type        = string
  default     = "agent-monitor"
}

variable "chart_path" {
  description = "Path to the bundled CCAM Helm chart."
  type        = string
  default     = "../helm/agent-monitor"
}

variable "image_repository" {
  description = "Registry repository for the dashboard image."
  type        = string
}

variable "image_tag" {
  description = "Immutable dashboard image tag. Prefer a release tag or commit SHA."
  type        = string
  validation {
    condition     = var.image_tag != "" && var.image_tag != "latest"
    error_message = "image_tag must be immutable and cannot be latest."
  }
}

variable "image_digest" {
  description = "Optional sha256 image digest. When set, it takes precedence over image_tag."
  type        = string
  default     = ""
  validation {
    condition     = var.image_digest == "" || can(regex("^sha256:[0-9a-f]{64}$", var.image_digest))
    error_message = "image_digest must be empty or a sha256 digest."
  }
}

variable "mcp_enabled" {
  description = "Enable the MCP sidecar."
  type        = bool
  default     = false
}

variable "mcp_image_repository" {
  description = "Registry repository for the MCP image."
  type        = string
  default     = ""
}

variable "mcp_image_tag" {
  description = "Immutable MCP image tag."
  type        = string
  default     = ""
  validation {
    condition     = var.mcp_image_tag == "" || var.mcp_image_tag != "latest"
    error_message = "mcp_image_tag cannot be latest."
  }
}

variable "existing_secret_name" {
  description = "Existing Secret with dashboard-token, hook-token, and mcp-token keys. Manage it with External Secrets or the cloud secret controller."
  type        = string
  default     = "agent-monitor-secrets"
}

variable "storage_class" {
  description = "Cloud-specific CSI StorageClass. Empty uses the cluster default."
  type        = string
  default     = ""
}

variable "storage_size" {
  description = "Persistent volume size."
  type        = string
  default     = "20Gi"
}

variable "allowed_hosts" {
  description = "Comma-separated public and internal hostnames accepted by CCAM's Host guard."
  type        = string
}

variable "ingress_enabled" {
  description = "Create a standard Kubernetes Ingress."
  type        = bool
  default     = false
}

variable "ingress_class_name" {
  description = "IngressClass name."
  type        = string
  default     = ""
}

variable "hostname" {
  description = "Public dashboard hostname."
  type        = string
  default     = ""
}

variable "tls_secret_name" {
  description = "TLS Secret used by Ingress."
  type        = string
  default     = ""
}

variable "gateway_api_enabled" {
  description = "Create an HTTPRoute instead of Ingress."
  type        = bool
  default     = false
}

variable "gateway_name" {
  description = "Parent Gateway name."
  type        = string
  default     = "shared-gateway"
}

variable "gateway_namespace" {
  description = "Parent Gateway namespace."
  type        = string
  default     = "gateway-system"
}

variable "gateway_section_name" {
  description = "Parent Gateway listener section name."
  type        = string
  default     = "https"
}

variable "service_monitor_enabled" {
  description = "Create a Prometheus Operator ServiceMonitor."
  type        = bool
  default     = false
}

variable "extra_values" {
  description = "Additional Helm values merged last. Do not use this to override replicaCount, autoscaling, or persistence safety."
  type        = any
  default     = {}
}
