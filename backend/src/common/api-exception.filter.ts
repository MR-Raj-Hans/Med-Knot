import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { id?: string }>();
    const response = context.getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : 'Request could not be completed.';
      if (typeof body === 'object' && body && 'message' in body) {
        const value = (body as { message?: unknown }).message;
        message = Array.isArray(value) ? value.join('; ') : typeof value === 'string' ? value : message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      status = HttpStatus.CONFLICT;
      message = 'An account with those details already exists.';
    }

    response.status(status).json({ statusCode: status, error: HttpStatus[status] ?? 'Error', message, requestId: request.id });
  }
}
