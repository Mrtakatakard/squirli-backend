import { Express, Router } from 'express';
import { readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import logger from '../utils/logger';

interface AutoRouteConfig {
  name: string;
  path: string;
  router: Router;
  file: string;
}

// Function to automatically discover and load routes
export const autoLoadRoutes = async (
  app: Express, 
  routesDir: string = __dirname, 
  verbose: boolean = false
): Promise<void> => {
  const routes: AutoRouteConfig[] = [];
  
  try {
    // Read all files in routes directory
    const files = readdirSync(routesDir)
      .filter(file => {
        const fullPath = join(routesDir, file);
        const isFile = statSync(fullPath).isFile();
        const isTypeScript = extname(file) === '.ts';
        const isNotIndex = !file.startsWith('index') && !file.startsWith('auto-loader');
        
        return isFile && isTypeScript && isNotIndex;
      });

    // Load each route file
    for (const file of files) {
      try {
        const routeName = basename(file, '.ts');
        const modulePath = join(routesDir, file);
        
        // Dynamic import
        const routeModule = await import(modulePath);
        const router = routeModule.default || routeModule.router;
        
        if (router && typeof router === 'function') {
          // Generate path based on file name
          let routePath = '';
          
          if (routeName === 'health') {
            routePath = '/health';
          } else if (routeName === 'api') {
            routePath = '/api/v1';
          } else {
            routePath = `/api/v1/${routeName}`;
          }
          
          routes.push({
            name: routeName,
            path: routePath,
            router,
            file
          });
        }
                      } catch (error) {
                  if (verbose) {
                    logger.warn(`⚠️  Failed to load route ${file}:`, error);
                  }
                }
    }
    
                    // Register all discovered routes
                routes.forEach(({ path, router }) => {
                  app.use(path, router);
                });
    
          logger.info(`🚀 ${routes.length} routes auto-loaded`);
    
      } catch (error) {
      logger.error('❌ Error auto-loading routes:', error);
      throw error;
    }
};

// Function to get route information for debugging
export const getAutoLoadedRoutes = async (routesDir: string = __dirname): Promise<AutoRouteConfig[]> => {
  const routes: AutoRouteConfig[] = [];
  
  try {
    const files = readdirSync(routesDir)
      .filter(file => {
        const fullPath = join(routesDir, file);
        const isFile = statSync(fullPath).isFile();
        const isTypeScript = extname(file) === '.ts';
        const isNotIndex = !file.startsWith('index') && !file.startsWith('auto-loader');
        
        return isFile && isTypeScript && isNotIndex;
      });

    for (const file of files) {
      const routeName = basename(file, '.ts');
      const modulePath = join(routesDir, file);
      
      try {
        const routeModule = await import(modulePath);
        const router = routeModule.default || routeModule.router;
        
        if (router) {
          let routePath = '';
          
          if (routeName === 'health') {
            routePath = '/health';
          } else if (routeName === 'api') {
            routePath = '/api/v1';
          } else {
            routePath = `/api/v1/${routeName}`;
          }
          
          routes.push({
            name: routeName,
            path: routePath,
            router,
            file
          });
        }
                      } catch (error) {
                  logger.warn(`⚠️  Failed to analyze route ${file}:`, error);
                }
    }
      } catch (error) {
      logger.error('❌ Error getting auto-loaded routes:', error);
    }
  
  return routes;
}; 