export const notFoundHandler = (request, response) => {
  response.status(404).json({
    code: 'NOT_FOUND',
    message: 'Route not found'
  });
};

export const errorHandler = (error, request, response, next) => {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json({
    code,
    message: statusCode >= 500 ? 'Internal server error' : error.message,
    ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {})
  });
};
