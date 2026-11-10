const validate = (schema, property) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      });
    }

    // Replace request data with validated data
    // req[property] = value;
    if (property === "query") {
      req.validatedQuery = value;
    } else {
      req[property] = value;
    }

    next();
  };
};

module.exports = validate;
