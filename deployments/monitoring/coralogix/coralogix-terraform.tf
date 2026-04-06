# ─────────────────────────────────────────────────────────────────────────────
# Coralogix Terraform Integration for Claude Code Agent Monitor
#
# Provisions Coralogix resources via the official Terraform provider:
#   - Alert rules (mirroring Prometheus/Alertmanager rules)
#   - Log parsing rules for structured JSON ingestion
#   - Recording rules for pre-aggregated SLO metrics
#   - Dashboard provisioning
#
# Usage:
#   export CORALOGIX_API_KEY="<your-send-your-data-key>"
#   export CORALOGIX_ENV="<your-coralogix-domain>"  # e.g. coralogix.com
#   terraform init
#   terraform plan
#   terraform apply
#
# Requires: hashicorp/terraform >= 1.5, coralogix/coralogix >= 1.10
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.5"
  required_providers {
    coralogix = {
      source  = "coralogix/coralogix"
      version = "~> 1.10"
    }
  }
}

provider "coralogix" {
  # API key and environment are sourced from:
  #   CORALOGIX_API_KEY  – Send-Your-Data API key
  #   CORALOGIX_ENV      – Domain (e.g. coralogix.com, eu2.coralogix.com)
}

# ── Variables ────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be one of: dev, staging, production."
  }
}

variable "notification_group_id" {
  description = "Coralogix notification group ID for alert routing"
  type        = string
  default     = ""
}

variable "pagerduty_webhook_id" {
  description = "Coralogix outbound webhook ID for PagerDuty integration"
  type        = string
  default     = ""
}

variable "slack_webhook_id" {
  description = "Coralogix outbound webhook ID for Slack integration"
  type        = string
  default     = ""
}

locals {
  app_name    = "agent-monitor"
  subsystem   = "kubernetes"
  alert_prefix = "[Agent Monitor]"
}

# ── Parsing Rules ────────────────────────────────────────────────────────────
# Structured JSON log parsing for agent-monitor application logs

resource "coralogix_rules_group" "agent_monitor_parsing" {
  name         = "${local.alert_prefix} Log Parsing"
  description  = "Parse structured JSON logs from Agent Monitor pods"
  enabled      = true
  order        = 1

  rule_subgroups {
    rules {
      name        = "JSON Extract"
      description = "Extract structured fields from JSON application logs"
      source_field = "text"
      enabled     = true

      parse_json_field {
        destination_field = "json"
        keep_source_field = false
        keep_destination_field = true
      }
    }
  }

  rule_subgroups {
    rules {
      name        = "Severity Mapping"
      description = "Map log level field to Coralogix severity"
      source_field = "json.level"
      enabled     = true

      extract {
        regexp = "(?P<severity>debug|info|warn|error|fatal)"
      }
    }
  }
}

# ── Recording Rules ──────────────────────────────────────────────────────────
# Pre-aggregate SLO metrics for efficient dashboard queries

resource "coralogix_recording_rule_group_set" "slo_metrics" {
  name = "${local.alert_prefix} SLO Recording Rules"

  groups {
    name     = "agent_monitor_slo"
    interval = 60 # seconds

    rules {
      record = "agent_monitor:http_availability:ratio_rate5m"
      expr   = <<-EOT
        1 - (
          sum(rate(http_requests_total{job="agent-monitor", status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total{job="agent-monitor"}[5m]))
        )
      EOT
      labels = {
        service     = local.app_name
        environment = var.environment
      }
    }

    rules {
      record = "agent_monitor:http_latency_p95:seconds_rate5m"
      expr   = <<-EOT
        histogram_quantile(0.95,
          sum(rate(http_request_duration_seconds_bucket{job="agent-monitor"}[5m])) by (le)
        )
      EOT
      labels = {
        service     = local.app_name
        environment = var.environment
      }
    }

    rules {
      record = "agent_monitor:websocket_connections:total"
      expr   = <<-EOT
        sum(websocket_connections_active{job="agent-monitor"})
      EOT
      labels = {
        service     = local.app_name
        environment = var.environment
      }
    }
  }
}

# ── Alert Rules ──────────────────────────────────────────────────────────────

resource "coralogix_alert" "instance_down" {
  name        = "${local.alert_prefix} Instance Down"
  description = "No metrics received from agent-monitor pods for > 2 minutes"
  severity    = "Critical"
  enabled     = true

  metric {
    promql {
      text      = "up{job=\"agent-monitor\"} == 0"
      condition = "more_than"
      threshold = 0
    }
    duration = "2m"
  }

  notifications_group {
    dynamic "notification" {
      for_each = var.pagerduty_webhook_id != "" ? [1] : []
      content {
        integration_id = var.pagerduty_webhook_id
      }
    }
    dynamic "notification" {
      for_each = var.slack_webhook_id != "" ? [1] : []
      content {
        integration_id = var.slack_webhook_id
      }
    }
  }

  labels = {
    service     = local.app_name
    environment = var.environment
    team        = "platform"
  }
}

resource "coralogix_alert" "high_error_rate" {
  name        = "${local.alert_prefix} High Error Rate"
  description = "5xx error rate exceeds 5% of total requests for 5 minutes"
  severity    = "Critical"
  enabled     = true

  metric {
    promql {
      text = <<-EOT
        (
          sum(rate(http_requests_total{job="agent-monitor", status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total{job="agent-monitor"}[5m]))
        ) * 100 > 5
      EOT
      condition = "more_than"
      threshold = 5
    }
    duration = "5m"
  }

  notifications_group {
    dynamic "notification" {
      for_each = var.pagerduty_webhook_id != "" ? [1] : []
      content {
        integration_id = var.pagerduty_webhook_id
      }
    }
  }

  labels = {
    service     = local.app_name
    environment = var.environment
  }
}

resource "coralogix_alert" "high_latency" {
  name        = "${local.alert_prefix} High Latency"
  description = "P95 request latency exceeds 2 seconds for 5 minutes"
  severity    = "Warning"
  enabled     = true

  metric {
    promql {
      text      = "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"agent-monitor\"}[5m])) by (le)) > 2"
      condition = "more_than"
      threshold = 2
    }
    duration = "5m"
  }

  notifications_group {
    dynamic "notification" {
      for_each = var.slack_webhook_id != "" ? [1] : []
      content {
        integration_id = var.slack_webhook_id
      }
    }
  }

  labels = {
    service     = local.app_name
    environment = var.environment
  }
}

resource "coralogix_alert" "high_memory" {
  name        = "${local.alert_prefix} High Memory Usage"
  description = "Container memory usage exceeds 85% of limit"
  severity    = "Warning"
  enabled     = true

  metric {
    promql {
      text = <<-EOT
        (
          container_memory_working_set_bytes{namespace=~"agent-monitor.*", container="agent-monitor"}
          /
          container_spec_memory_limit_bytes{namespace=~"agent-monitor.*", container="agent-monitor"}
        ) * 100 > 85
      EOT
      condition = "more_than"
      threshold = 85
    }
    duration = "5m"
  }

  notifications_group {
    dynamic "notification" {
      for_each = var.slack_webhook_id != "" ? [1] : []
      content {
        integration_id = var.slack_webhook_id
      }
    }
  }

  labels = {
    service     = local.app_name
    environment = var.environment
  }
}

resource "coralogix_alert" "pod_restart_loop" {
  name        = "${local.alert_prefix} Pod Restart Loop"
  description = "Agent Monitor pod has restarted > 5 times in 15 minutes"
  severity    = "Critical"
  enabled     = true

  metric {
    promql {
      text      = "increase(kube_pod_container_status_restarts_total{namespace=~\"agent-monitor.*\", container=\"agent-monitor\"}[15m]) > 5"
      condition = "more_than"
      threshold = 5
    }
    duration = "1m"
  }

  notifications_group {
    dynamic "notification" {
      for_each = var.pagerduty_webhook_id != "" ? [1] : []
      content {
        integration_id = var.pagerduty_webhook_id
      }
    }
  }

  labels = {
    service     = local.app_name
    environment = var.environment
  }
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "parsing_rule_group_id" {
  description = "ID of the Coralogix parsing rule group"
  value       = coralogix_rules_group.agent_monitor_parsing.id
}

output "recording_rule_set_id" {
  description = "ID of the Coralogix recording rule group set"
  value       = coralogix_recording_rule_group_set.slo_metrics.id
}

output "alert_ids" {
  description = "IDs of all provisioned Coralogix alerts"
  value = {
    instance_down   = coralogix_alert.instance_down.id
    high_error_rate = coralogix_alert.high_error_rate.id
    high_latency    = coralogix_alert.high_latency.id
    high_memory     = coralogix_alert.high_memory.id
    pod_restart     = coralogix_alert.pod_restart_loop.id
  }
}
