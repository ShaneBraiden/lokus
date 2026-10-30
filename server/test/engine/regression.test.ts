import { describe, expect, it } from 'vitest';
import { defaultScoringPackage, runRegressionSuite } from '../src';

describe('runRegressionSuite (used to gate package publishing)', () => {
  it('passes every persona on the default v1.1 package', () => {
    const report = runRegressionSuite(defaultScoringPackage());
    expect(report.failed, JSON.stringify(report.cases.filter((c) => !c.passed), null, 2)).toBe(0);
    expect(report.total).toBe(17);
  });

  it('fails when a parameter change alters persona outcomes', () => {
    const pkg = defaultScoringPackage();
    pkg.parameters.BAND_MEETS = 96;
    const report = runRegressionSuite(pkg);
    expect(report.passed).toBe(false);
    expect(report.cases.find((c) => c.persona_id === 'p05')?.mismatches.join(' ')).toContain('outcome');
  });
});
