const Joi = require("joi");

// 1. Create Employee Validation
const createEmployeeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),

  email: Joi.string().trim().email().max(150).required(),

  department: Joi.string().trim().max(100).allow("", null),

  salary: Joi.number().min(0).allow(null),
});

// 2. Update Employee Validation
const updateEmployeeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),

  email: Joi.string().trim().email().max(150).required(),

  department: Joi.string().trim().max(100).allow("", null),

  salary: Joi.number().min(0).allow(null),
});

// 3. Employee ID Validation
const employeeIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

// 4. Pagination and Search Validation
const employeeQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(100).default(10),

  department: Joi.string().trim().max(100).allow(""),
});

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeIdSchema,
  employeeQuerySchema,
};
