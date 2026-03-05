import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

export interface ApiEnvelope<T> {
  data: T;
  message: string;
  code: number;
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiEnvelope<T>> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();
    return next.handle().pipe(
      map((data) => {
        const statusCode = response.statusCode ?? 200;
        return {
          data,
          message: 'success',
          code: statusCode,
        };
      }),
    );
  }
}
