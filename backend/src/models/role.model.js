'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Role';
const COLLECTION_NAME = 'Roles';

const roleSchema = new Schema(
  {
    rol_name: { type: String, required: true, unique: true },
    rol_permissions: { type: [String], default: [] },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, roleSchema);
