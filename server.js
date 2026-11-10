const cluster = require("node:cluster");
const os = require("node:os");
const express = require("express");
const pool = require("./config/db");
const numCPUs = os.availableParallelism();
const validate = require("./middleware/validate");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const logger = require("./utils/logger");

const {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeIdSchema,
  employeeQuerySchema,
} = require("./validations/employeeValidation");

if (cluster.isPrimary) {
  console.log(`Primary process: ${process.pid}`);
  console.log(`Available CPU cores: ${numCPUs}`);

  let restartCount = 0;

  // Function to create a worker
  function createWorker() {
    const worker = cluster.fork();

    console.log(
      `Worker created | ID: ${worker.id} | PID: ${worker.process.pid}`,
    );

    return worker;
  }

  // Create initial workers
  for (let i = 0; i < numCPUs; i++) {
    createWorker();
  }

  // Monitor worker exit
  cluster.on("exit", (worker, code, signal) => {
    console.log("Worker stopped");

    console.log({
      workerId: worker.id,
      pid: worker.process.pid,
      exitCode: code,
      signal: signal,
    });

    restartCount++;

    console.log(`Total restarts: ${restartCount}`);
    console.log("Starting replacement worker...");

    createWorker();
  });
} else {
  const app = express();

  // Parse JSON request body
  app.use(express.json());

  // Parse form-urlencoded request body
  //   app.use(express.urlencoded({ extended: true }));
  // HTTP request logging

  app.use(requestLogger);

  // All your existing APIs
  // app.get()
  // app.post()
  // app.put()
  // app.delete()

  // Unknown route handler

  // Health API
  app.get("/api/health", (req, res) => {
    res.json({
      status: "Healthy",
      workerId: cluster.worker.id,
      processId: process.pid,
    });
  });

  app.post(
    "/api/employees",
    validate(createEmployeeSchema, "body"),
    async (req, res) => {
      try {
        console.log("Request body:", req.body);
        const { name, email, department, salary } = req.body;

        // Basic validation
        if (!name || !email) {
          return res.status(400).json({
            message: "Name and email are required",
          });
        }

        const query = `
            INSERT INTO public.employees_cluster
            (name, email, department, salary)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const values = [name, email, department || null, salary || null];

        const result = await pool.query(query, values);

        res.status(201).json({
          message: "Employee created successfully",
          employee: result.rows[0],
          handledBy: process.pid,
        });
      } catch (error) {
        console.error("Employee creation error:", error);

        if (error.code === "23505") {
          return res.status(409).json({
            message: "Email already exists",
          });
        }

        res.status(500).json({
          message: "Internal server error",
        });
      }
    },
  );

  // Employee API

  // GET: Fetch all employees from PostgreSQL
  app.get("/api/employees", async (req, res) => {
    try {
      const query = `
      SELECT
        id,
        name,
        email,
        department,
        salary,
        created_at
      FROM public.employees_cluster
      ORDER BY id DESC
    `;

      const result = await pool.query(query);

      return res.status(200).json({
        success: true,
        count: result.rowCount,
        employees: result.rows,
        handledBy: process.pid,
        workerId: cluster.worker.id,
      });
    } catch (error) {
      console.error("Fetch employees error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to fetch employees",
      });
    }
  });

  // GET: Fetch employee by ID
  app.get(
    "/api/employees/:id",
    validate(employeeIdSchema, "params"),
    async (req, res) => {
      try {
        const { id } = req.params;

        // Validate employee ID
        if (!/^[1-9]\d*$/.test(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid employee ID",
          });
        }

        const query = `
      SELECT
        id,
        name,
        email,
        department,
        salary,
        created_at
      FROM public.employees_cluster
      WHERE id = $1
    `;

        const result = await pool.query(query, [id]);

        // Employee not found
        if (result.rowCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Employee not found",
          });
        }

        return res.status(200).json({
          success: true,
          employee: result.rows[0],
          handledBy: process.pid,
          workerId: cluster.worker.id,
        });
      } catch (error) {
        console.error("Get employee by ID error:", error);

        return res.status(500).json({
          success: false,
          message: "Unable to fetch employee",
        });
      }
    },
  );

  // PUT API - Update Employee
  app.put(
    "/api/employees/:id",
    validate(employeeIdSchema, "params"),
    validate(updateEmployeeSchema, "body"),
    async (req, res) => {
      try {
        // 1. Get employee ID from URL
        const { id } = req.params;

        // 2. Get updated data from request body
        const { name, email, department, salary } = req.body;

        // 3. Validate employee ID
        if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid employee ID",
          });
        }

        // 4. Validate required fields
        if (!name || !email) {
          return res.status(400).json({
            success: false,
            message: "Name and email are required",
          });
        }

        // 5. Update employee in PostgreSQL
        const query = `
      UPDATE public.employees_cluster
      SET
        name = $1,
        email = $2,
        department = $3,
        salary = $4
      WHERE id = $5
      RETURNING id, name, email, department, salary, created_at
    `;

        const values = [
          name,
          email,
          department || null,
          salary ?? null,
          Number(id),
        ];

        const result = await pool.query(query, values);

        // 6. Check employee exists
        if (result.rowCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Employee not found",
          });
        }

        // 7. Return updated employee
        return res.status(200).json({
          success: true,
          message: "Employee updated successfully",
          employee: result.rows[0],
          handledBy: process.pid,
          workerId: cluster.worker.id,
        });
      } catch (error) {
        console.error("Update Employee Error:", error);

        // Duplicate email handling
        if (error.code === "23505") {
          return res.status(409).json({
            success: false,
            message: "Email already exists",
          });
        }

        return res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );

  // DELETE API - Delete Employee
  app.delete(
    "/api/employees/:id",
    validate(employeeIdSchema, "params"),
    async (req, res) => {
      try {
        // 1. Get employee ID from URL
        const { id } = req.params;

        // 2. Validate employee ID
        if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid employee ID",
          });
        }

        // 3. Delete employee from PostgreSQL
        const query = `
      DELETE FROM public.employees_cluster
      WHERE id = $1
      RETURNING id, name, email, department, salary
    `;

        const result = await pool.query(query, [Number(id)]);

        // 4. Check employee exists
        if (result.rowCount === 0) {
          return res.status(404).json({
            success: false,
            message: "Employee not found",
          });
        }

        // 5. Return success response
        return res.status(200).json({
          success: true,
          message: "Employee deleted successfully",
          deletedEmployee: result.rows[0],
          handledBy: process.pid,
          workerId: cluster.worker.id,
        });
      } catch (error) {
        console.error("Delete Employee Error:", error);

        return res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );

  // GET API - Pagination and Department Search

  app.get(
    "/api/employees_with_pagination",
    validate(employeeQuerySchema, "query"),
    async (req, res) => {
      try {
        // 1. Get query parameters
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const department = req.query.department?.trim();

        // 2. Validate pagination
        if (
          !Number.isInteger(page) ||
          !Number.isInteger(limit) ||
          page < 1 ||
          limit < 1 ||
          limit > 100
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid page or limit. Limit must be between 1 and 100.",
          });
        }

        // 3. Calculate offset
        const offset = (page - 1) * limit;

        // 4. Build dynamic WHERE condition safely
        const conditions = [];
        const filterValues = [];

        if (department) {
          filterValues.push(department);
          conditions.push(`LOWER(department) = LOWER($${filterValues.length})`);
        }

        const whereClause = conditions.length
          ? `WHERE ${conditions.join(" AND ")}`
          : "";

        // 5. Get total records
        const countQuery = `
      SELECT COUNT(*) AS total
      FROM public.employees_cluster
      ${whereClause}
    `;

        const countResult = await pool.query(countQuery, filterValues);

        const totalRecords = Number(countResult.rows[0].total);

        // 6. Get employees with pagination
        const dataValues = [...filterValues, limit, offset];

        const employeesQuery = `
      SELECT id, name, email, department, salary, created_at
      FROM public.employees_cluster
      ${whereClause}
      ORDER BY id ASC
      LIMIT $${filterValues.length + 1}
      OFFSET $${filterValues.length + 2}
    `;

        const employeesResult = await pool.query(employeesQuery, dataValues);

        // 7. Calculate total pages
        const totalPages = Math.ceil(totalRecords / limit);

        // 8. Return response
        return res.status(200).json({
          success: true,
          pagination: {
            currentPage: page,
            limit,
            offset,
            totalRecords,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1 && totalPages > 0,
          },
          employees: employeesResult.rows,
        });
      } catch (error) {
        console.error("Get Employees Error:", error);

        return res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );

  // Testing API: Crash current worker
  app.get("/api/crash", (req, res) => {
    res.json({
      message: "Worker is going to crash",
      workerId: cluster.worker.id,
      processId: process.pid,
    });

    setTimeout(() => {
      process.exit(1);
    }, 100);
  });

  app.use(notFound);

  // Global error handler (must be last)
  app.use(errorHandler);

  // Start server
  app.listen(3000, () => {
    console.log(`Worker ${process.pid} started on port 3000`);
  });
}
