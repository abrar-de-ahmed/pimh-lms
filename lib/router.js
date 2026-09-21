'use strict';

class Router {
  constructor() {
    this.routes = []; // { method, regex, keys, handler }
  }

  _add(method, path, handler) {
    const keys = [];
    const pattern = path
      .replace(/\/:[a-zA-Z_]+/g, (m) => {
        keys.push(m.slice(2));
        return '/([^/]+)';
      });
    const regex = new RegExp('^' + pattern + '/?$');
    this.routes.push({ method, regex, keys, handler });
  }

  get(path, handler) { this._add('GET', path, handler); }
  post(path, handler) { this._add('POST', path, handler); }
  put(path, handler) { this._add('PUT', path, handler); }
  patch(path, handler) { this._add('PATCH', path, handler); }
  delete(path, handler) { this._add('DELETE', path, handler); }

  async handle(req, res, pathname) {
    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const match = route.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]); });
      req.params = params;
      await route.handler(req, res);
      return true;
    }
    return false;
  }
}

module.exports = Router;
