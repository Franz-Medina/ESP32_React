const errorHandler = (err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);

  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
};

module.exports = errorHandler;