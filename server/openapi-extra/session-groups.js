/**
 * @file OpenAPI definitions for dashboard-local session groups and bulk membership.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const error = { $ref: "#/components/schemas/ErrorResponse" };
const json = (schema) => ({ "application/json": { schema } });
const group = { $ref: "#/components/schemas/SessionGroup" };
const groupResponse = { type: "object", properties: { group } };
const groupName = {
  required: true,
  content: json({
    type: "object",
    required: ["name"],
    properties: { name: { type: "string", minLength: 1, maxLength: 100 } },
  }),
};
const groupId = { name: "id", in: "path", required: true, schema: { type: "string" } };

module.exports = {
  tags: [{ name: "Session Groups", description: "Local organization of durable sessions" }],
  schemas: {
    SessionGroup: {
      type: "object",
      required: ["id", "name", "created_at", "updated_at"],
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
      },
    },
  },
  paths: {
    "/api/session-groups": {
      get: {
        tags: ["Session Groups"],
        operationId: "listSessionGroups",
        summary: "List session groups",
        responses: {
          200: {
            description: "Groups",
            content: json({
              type: "object",
              properties: { groups: { type: "array", items: group } },
            }),
          },
        },
      },
      post: {
        tags: ["Session Groups"],
        operationId: "createSessionGroup",
        summary: "Create a group",
        requestBody: groupName,
        responses: {
          201: { description: "Created", content: json(groupResponse) },
          400: { description: "Invalid name", content: json(error) },
          409: { description: "Name exists", content: json(error) },
        },
      },
    },
    "/api/session-groups/{id}": {
      patch: {
        tags: ["Session Groups"],
        operationId: "renameSessionGroup",
        summary: "Rename a group",
        parameters: [groupId],
        requestBody: groupName,
        responses: {
          200: { description: "Renamed", content: json(groupResponse) },
          404: { description: "Group not found", content: json(error) },
          409: { description: "Name exists", content: json(error) },
        },
      },
      delete: {
        tags: ["Session Groups"],
        operationId: "deleteSessionGroup",
        summary: "Delete group and unassign its sessions",
        parameters: [groupId],
        responses: {
          200: {
            description: "Deleted; sessions preserved",
            content: json({ type: "object", properties: { deleted: { type: "boolean" } } }),
          },
          404: { description: "Group not found", content: json(error) },
        },
      },
    },
    "/api/sessions/group": {
      patch: {
        tags: ["Sessions"],
        operationId: "assignSessionGroup",
        summary: "Assign a group to selected sessions",
        description:
          "Atomically updates 1–10000 distinct durable sessions in the selected source/provider scope. Null unassigns them.",
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["session_ids", "group_id"],
            properties: {
              session_ids: {
                type: "array",
                minItems: 1,
                maxItems: 10000,
                uniqueItems: true,
                items: { type: "string" },
              },
              group_id: { type: "string", nullable: true },
            },
          }),
        },
        responses: {
          200: {
            description: "Updated",
            content: json({ type: "object", properties: { updated: { type: "integer" } } }),
          },
          400: { description: "Invalid selection", content: json(error) },
          404: { description: "Session or group not found", content: json(error) },
        },
      },
    },
  },
};
