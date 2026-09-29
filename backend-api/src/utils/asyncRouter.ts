import { Router, RouterOptions, IRouter, IRoute, NextFunction, Request, Response } from 'express';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyHandler = (...args: any[]) => any;

const METHODS = ['all', 'get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

/**
 * Express 4 does not forward rejected promises to `next`, so an async controller that
 * throws, a Mongoose ValidationError, a failed upload, becomes an unhandled rejection
 * and takes the whole process down. Wrapping routes them to the error handler instead.
 */
function wrap(fn: AnyHandler): AnyHandler {
  // Error-handling middleware takes 4 args and must keep its arity to stay recognised
  // by Express; anything that isn't a function (a nested router, a path) passes through.
  if (typeof fn !== 'function' || fn.length >= 4) return fn;
  return function wrapped(this: unknown, req: Request, res: Response, next: NextFunction) {
    try {
      return Promise.resolve(fn.call(this, req, res, next)).catch(next);
    } catch (err) {
      return next(err);
    }
  };
}

const wrapAll = (args: any[]) => args.map((a) => (Array.isArray(a) ? a.map(wrap) : wrap(a)));

/**
 * Drop-in replacement for `express.Router()` whose handlers may be async. Covers both
 * `router.get(...)` and the `router.route(path).get(...).post(...)` chaining style.
 */
export function asyncRouter(options?: RouterOptions): IRouter {
  const router = Router(options);

  for (const method of [...METHODS, 'use'] as const) {
    const original = (router as any)[method].bind(router);
    (router as any)[method] = (...args: any[]) => original(...wrapAll(args));
  }

  const originalRoute = router.route.bind(router);
  router.route = (path: any): IRoute => {
    const route = originalRoute(path);
    for (const method of METHODS) {
      const original = (route as any)[method].bind(route);
      (route as any)[method] = (...args: any[]) => {
        original(...wrapAll(args));
        return route;
      };
    }
    return route;
  };

  return router;
}
