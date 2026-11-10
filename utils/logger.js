const winston = require("winston");
const path = require("path");

const logDirectory = path.join(__dirname, "../logs");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",

  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),

    winston.format.errors({
      stack: true,
    }),

    winston.format.json(),
  ),

  defaultMeta: {
    service: "employee-backend",
  },

  transports: [
    // All logs
    new winston.transports.File({
      filename: path.join(logDirectory, "combined.log"),
    }),

    // Only error logs
    new winston.transports.File({
      filename: path.join(logDirectory, "error.log"),
      level: "error",
    }),
  ],
});

// Console logging in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
}

module.exports = logger;
