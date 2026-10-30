import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/ui/Button';
import { Logo } from '@/ui/misc';

/** Last-resort error screen. A failed chunk load usually means a new version was deployed: reloading fixes it. */
export function RouteError() {
  const error = useRouteError();
  const chunk = error instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message);
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div>
        <h1 className="text-xl font-semibold text-ink">{notFound ? 'We couldn’t find that page' : chunk ? 'Lokus has been updated' : 'Something went wrong'}</h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          {chunk ? 'Reload the page to get the latest version. Your work is saved.' : 'Reload the page to try again. If an assessment was open, your work up to the last action is saved.'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Button asChild variant="secondary">
          <a href="/">Home</a>
        </Button>
      </div>
    </div>
  );
}
