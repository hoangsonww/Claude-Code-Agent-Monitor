locals {
  kubeconfig_path = pathexpand(var.kubeconfig_path)
  chart_path      = abspath("${path.module}/${var.chart_path}")

  values = merge(
    {
      replicaCount = 1
      autoscaling = {
        enabled = false
      }
      image = {
        registry   = ""
        repository = var.image_repository
        tag        = var.image_tag
        digest     = var.image_digest
      }
      persistence = {
        enabled      = true
        accessModes  = ["ReadWriteOnce"]
        size         = var.storage_size
        storageClass = var.storage_class
        retain       = true
      }
      secrets = {
        create         = false
        existingSecret = var.existing_secret_name
      }
      config = {
        NODE_ENV                 = "production"
        DASHBOARD_HOST           = "0.0.0.0"
        DASHBOARD_PORT           = "4820"
        DASHBOARD_DATA_DIR       = "/app/data"
        DASHBOARD_ENV_PATH       = "/app/data/config/.env"
        CLAUDE_HOME              = "/app/data/claude"
        DASHBOARD_CODEX_HOME     = "/app/data/codex"
        DASHBOARD_LIVENESS_PROBE = "0"
        DASHBOARD_ALLOWED_HOSTS  = var.allowed_hosts
      }
      ingress = {
        enabled   = var.ingress_enabled
        className = var.ingress_class_name
        hosts = var.hostname == "" ? [] : [{
          host = var.hostname
          paths = [{
            path     = "/"
            pathType = "Prefix"
          }]
        }]
        tls = var.tls_secret_name == "" || var.hostname == "" ? [] : [{
          secretName = var.tls_secret_name
          hosts      = [var.hostname]
        }]
      }
      gatewayAPI = {
        enabled = var.gateway_api_enabled
        parentRefs = [{
          name        = var.gateway_name
          namespace   = var.gateway_namespace
          sectionName = var.gateway_section_name
        }]
        hostnames = var.hostname == "" ? [] : [var.hostname]
      }
      monitoring = {
        serviceMonitor = {
          enabled = var.service_monitor_enabled
        }
      }
      mcp = {
        enabled       = var.mcp_enabled
        exposeService = false
        image = {
          registry   = ""
          repository = var.mcp_image_repository
          tag        = var.mcp_image_tag
        }
      }
    },
    var.extra_values,
  )
}

provider "kubernetes" {
  config_path    = local.kubeconfig_path
  config_context = var.kube_context == "" ? null : var.kube_context
}

provider "helm" {
  kubernetes = {
    config_path    = local.kubeconfig_path
    config_context = var.kube_context == "" ? null : var.kube_context
  }
}

resource "kubernetes_namespace_v1" "ccam" {
  metadata {
    name = var.namespace
    labels = {
      "pod-security.kubernetes.io/enforce" = "restricted"
      "pod-security.kubernetes.io/audit"   = "restricted"
      "pod-security.kubernetes.io/warn"    = "restricted"
    }
  }
}

resource "helm_release" "ccam" {
  name        = var.release_name
  namespace   = kubernetes_namespace_v1.ccam.metadata[0].name
  chart       = local.chart_path
  atomic      = true
  wait        = true
  timeout     = 600
  max_history = 10

  values = [yamlencode(local.values)]

  lifecycle {
    precondition {
      condition     = try(local.values.replicaCount, 0) == 1
      error_message = "CCAM requires replicaCount=1 while SQLite is the persistence backend."
    }
    precondition {
      condition     = try(local.values.autoscaling.enabled, true) == false
      error_message = "CCAM does not support HPA while SQLite is the persistence backend."
    }
    precondition {
      condition     = try(local.values.persistence.enabled, false) == true
      error_message = "Persistent storage is required for production CCAM deployments."
    }
    precondition {
      condition     = !(var.ingress_enabled && var.gateway_api_enabled)
      error_message = "Enable Ingress or Gateway API, not both."
    }
    precondition {
      condition     = !var.mcp_enabled || (var.mcp_image_repository != "" && var.mcp_image_tag != "")
      error_message = "MCP image repository and immutable tag are required when MCP is enabled."
    }
  }
}
