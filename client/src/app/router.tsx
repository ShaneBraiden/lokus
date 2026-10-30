import type { ComponentType } from 'react';
import { Outlet, ScrollRestoration, createBrowserRouter } from 'react-router';
import type { AttemptPhase } from '@lokus/shared';
import { Landing } from '@/features/public/Landing';
import { Legal, NotFound } from '@/features/public/Legal';
import { PublicLayout } from '@/layouts/PublicLayout';
import { RedirectIfSignedIn } from '@/lib/auth';
import { PageLoader } from '@/ui/misc';
import { RouteError } from './RouteError';

/** Lazily loads one named component from a feature module (each dashboard and the player is its own chunk). */
function load<M>(importer: () => Promise<M>, name: keyof M) {
  return async () => ({ Component: (await importer())[name] as ComponentType });
}

/** Sign-in and sign-up send signed-in users to their dashboard. */
function publicOnly<M>(importer: () => Promise<M>, name: keyof M) {
  return async () => {
    const Page = (await importer())[name] as ComponentType;
    return {
      Component: () => (
        <RedirectIfSignedIn>
          <Page />
        </RedirectIfSignedIn>
      ),
    };
  };
}

const auth = () => import('@/features/public/AuthPages');
const invites = () => import('@/features/public/Invites');
const staffMfa = () => import('@/features/public/StaffMfa');
const candidate = () => import('@/features/candidate');
const player = () => import('@/simulation');
const employer = () => import('@/features/employer');
const admin = () => import('@/features/admin');

/** Player screens declare the attempt phases in which they are reachable; the shell redirects anything else. */
export interface ScreenHandle {
  screen: string;
  phases: AttemptPhase[];
}
const screen = (name: string, phases: AttemptPhase[], component: string) => ({
  path: name,
  handle: { screen: name, phases } satisfies ScreenHandle,
  lazy: load(player, component as never),
});

function Root() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <Landing /> },
          { path: 'legal/privacy', element: <Legal page="privacy" /> },
          { path: 'legal/terms', element: <Legal page="terms" /> },
          { path: '*', element: <NotFound /> },
        ],
      },
      { path: 'login', lazy: publicOnly(auth, 'SignIn') },
      { path: 'signup', lazy: publicOnly(auth, 'SignUp') },
      { path: 'forgot', lazy: load(auth, 'ForgotPassword') },
      { path: 'reset', lazy: load(auth, 'ResetPassword') },
      { path: 'verify', lazy: load(auth, 'VerifyEmail') },
      { path: 'invite', lazy: load(invites, 'AcceptInvite') },
      { path: 'team-invite', lazy: load(invites, 'AcceptTeamInvite') },
      { path: 'mfa', lazy: load(staffMfa, 'StaffMfa') },
      {
        path: 'app',
        lazy: load(candidate, 'CandidateArea'),
        children: [
          { index: true, lazy: load(candidate, 'CandidateHome') },
          { path: 'assessments/:attemptId', lazy: load(candidate, 'AssessmentDetail') },
          { path: 'privacy', lazy: load(candidate, 'PrivacySharing') },
          { path: 'profile', lazy: load(candidate, 'Profile') },
        ],
      },
      {
        path: 'sim/:attemptId',
        lazy: load(player, 'SimulationShell'),
        children: [
          { index: true, lazy: load(player, 'PhaseRedirect') },
          screen('overview', ['intro'], 'Overview'),
          screen('welcome', ['intro'], 'Workday1Welcome'),
          screen('briefing', ['workday1'], 'Briefing'),
          screen('workspace', ['workday1'], 'Workspace'),
          screen('review', ['workday1'], 'ReviewSubmit'),
          screen('workday-1-complete', ['between'], 'Workday1Complete'),
          screen('workday-2', ['between'], 'Workday2Intro'),
          screen('inbox', ['workday2'], 'MailWorkspace'),
          screen('debrief', ['done'], 'Debrief'),
          screen('complete', ['done'], 'Complete'),
          screen('closed', ['closed'], 'Closed'),
          { path: '*', lazy: load(player, 'PhaseRedirect') },
        ],
      },
      {
        path: 'org',
        lazy: load(employer, 'EmployerArea'),
        children: [
          { index: true, lazy: load(employer, 'EmployerOverview') },
          { path: 'candidates', lazy: load(employer, 'Candidates') },
          { path: 'invites', lazy: load(employer, 'Invites') },
          { path: 'results/:attemptId', lazy: load(employer, 'ResultReport') },
          { path: 'compare', lazy: load(employer, 'EmployerCompare') },
          { path: 'talent-pool', lazy: load(employer, 'TalentPool') },
          { path: 'talent-pool/:attemptId', lazy: load(employer, 'PoolReport') },
          { path: 'settings', lazy: load(employer, 'TeamSettings') },
          { path: '*', element: <NotFound /> },
        ],
      },
      {
        path: 'admin',
        lazy: load(admin, 'AdminArea'),
        children: [
          { index: true, lazy: load(admin, 'Overview') },
          { path: 'review', lazy: load(admin, 'ReviewQueue') },
          { path: 'review/:itemId', lazy: load(admin, 'ReviewItem') },
          { path: 'attempts', lazy: load(admin, 'Attempts') },
          { path: 'attempts/:attemptId', lazy: load(admin, 'AttemptDetailPage') },
          { path: 'compare', lazy: load(admin, 'Compare') },
          { path: 'packages', lazy: load(admin, 'Packages') },
          { path: 'packages/:packageId', lazy: load(admin, 'PackageDetailPage') },
          { path: 'content', lazy: load(admin, 'Content') },
          { path: 'orgs', lazy: load(admin, 'Orgs') },
          { path: 'users', lazy: load(admin, 'Users') },
          { path: 'audit', lazy: load(admin, 'Audit') },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
