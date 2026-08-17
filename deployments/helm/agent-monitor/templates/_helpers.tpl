{{/*
Expand the name of the chart.
*/}}
{{- define "agent-monitor.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this
(by the DNS naming spec). If release name contains the chart name it will be used
as a full name.
*/}}
{{- define "agent-monitor.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "agent-monitor.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "agent-monitor.labels" -}}
helm.sh/chart: {{ include "agent-monitor.chart" . }}
{{ include "agent-monitor.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: claude-code-agent-monitor
{{- end }}

{{/*
Selector labels
*/}}
{{- define "agent-monitor.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agent-monitor.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "agent-monitor.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "agent-monitor.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Return the container image string
*/}}
{{- define "agent-monitor.image" -}}
{{- if .Values.image.digest -}}
{{- if .Values.image.registry -}}
{{- printf "%s/%s@%s" .Values.image.registry .Values.image.repository .Values.image.digest -}}
{{- else -}}
{{- printf "%s@%s" .Values.image.repository .Values.image.digest -}}
{{- end -}}
{{- else -}}
{{- $tag := default .Chart.AppVersion .Values.image.tag -}}
{{- if .Values.image.registry -}}
{{- printf "%s/%s:%s" .Values.image.registry .Values.image.repository $tag -}}
{{- else -}}
{{- printf "%s:%s" .Values.image.repository $tag -}}
{{- end -}}
{{- end -}}
{{- end }}

{{/*
Return the MCP sidecar container image string
*/}}
{{- define "agent-monitor.mcpImage" -}}
{{- if .Values.mcp.image.digest -}}
{{- if .Values.mcp.image.registry -}}
{{- printf "%s/%s@%s" .Values.mcp.image.registry .Values.mcp.image.repository .Values.mcp.image.digest -}}
{{- else -}}
{{- printf "%s@%s" .Values.mcp.image.repository .Values.mcp.image.digest -}}
{{- end -}}
{{- else -}}
{{- $tag := default .Chart.AppVersion .Values.mcp.image.tag -}}
{{- if .Values.mcp.image.registry -}}
{{- printf "%s/%s:%s" .Values.mcp.image.registry .Values.mcp.image.repository $tag -}}
{{- else -}}
{{- printf "%s:%s" .Values.mcp.image.repository $tag -}}
{{- end -}}
{{- end -}}
{{- end }}
