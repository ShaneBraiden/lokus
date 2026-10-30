import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { EvidenceView } from '@lokus/shared';
import type { EmployerResult } from './employerReport';

/**
 * Employer PDF report: the same permitted fields as the web report (outcome, workday scores, critical flags,
 * competencies, and a summary of the evidence). Uses the built-in Helvetica family, so text sticks to WinAnsi.
 */

const INK = '#1C2430';
const MUTED = '#57534E';
const LINE = '#E7E5E4';
const ACCENT = '#A04E35';
const TONE: Record<string, string> = { MEETS_BAR: '#047857', PARTIALLY_MEETS_BAR: '#B45309', HOLD_FOR_REVIEW: '#6D28D9', DOES_NOT_MEET_BAR: '#BE123C', AWAITING_REVIEW: '#1D4ED8', INCOMPLETE: '#78716C' };

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 10, color: INK, lineHeight: 1.45 },
  brand: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: INK },
  muted: { color: MUTED },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginTop: 18 },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 6 },
  row: { flexDirection: 'row' },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10 },
  banner: { borderRadius: 6, padding: 12, marginTop: 14 },
  tile: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10 },
  track: { height: 5, backgroundColor: '#F7EEEA', borderTopRightRadius: 3, borderBottomRightRadius: 3, marginTop: 6 },
  bar: { height: 5, backgroundColor: ACCENT, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  small: { fontSize: 8.5 },
  footer: { position: 'absolute', bottom: 24, left: 44, right: 44, fontSize: 8, color: MUTED, flexDirection: 'row', justifyContent: 'space-between' },
});

const ascii = (t: string) => t.replace(/[≤]/g, '<=').replace(/[≥]/g, '>=').replace(/[^\u0000-ÿ–—‘’“”•…€]/g, '');
const mins = (m: number | null) => (m === null ? '-' : `${Math.floor(m)}m ${String(Math.round((m % 1) * 60)).padStart(2, '0')}s`);
const fmt = (d: Date | string | null) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : '-');

interface ReportInput {
  orgName: string;
  generatedAt: Date;
  candidate: { name: string; email: string; headline: string; location: string };
  attempt: { id: string; status_label: string; started_at: Date | null; submitted_at: Date | null };
  result: EmployerResult;
  evidence: EvidenceView;
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={s.tile}>
      <Text style={s.muted}>{label}</Text>
      <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>{value === null ? '-' : `${value}`}<Text style={{ fontSize: 9, color: MUTED }}> / 100</Text></Text>
      <View style={s.track}>
        <View style={[s.bar, { width: `${Math.max(0, Math.min(100, value ?? 0))}%` }]} />
      </View>
    </View>
  );
}

function ReportDocument(d: ReportInput) {
  const r = d.result;
  const t1 = d.evidence.t1;
  const t2 = d.evidence.t2;
  const tone = TONE[r.outcome] ?? INK;
  return (
    <Document title={`Lokus report - ${ascii(d.candidate.name)}`} author="Lokus" subject="NorthrSim Clinical Trial Associate result">
      <Page size="A4" style={s.page}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={s.brand}>Lokus</Text>
          <Text style={[s.muted, s.small]}>Prepared for {ascii(d.orgName)} - confidential</Text>
        </View>
        <Text style={s.h1}>{ascii(d.candidate.name)}</Text>
        <Text style={s.muted}>
          {ascii(d.candidate.email)}
          {d.candidate.headline ? ` - ${ascii(d.candidate.headline)}` : ''}
          {d.candidate.location ? ` - ${ascii(d.candidate.location)}` : ''}
        </Text>
        <Text style={[s.muted, s.small, { marginTop: 2 }]}>NorthrSim - Clinical Trial Associate - submitted {fmt(d.attempt.submitted_at)}</Text>

        <View style={[s.banner, { backgroundColor: `${tone}14`, borderWidth: 1, borderColor: `${tone}55` }]}>
          <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: tone }}>{r.outcome_label}</Text>
          <Text style={{ marginTop: 3 }}>{ascii(r.reason)}</Text>
        </View>

        <View style={[s.row, { gap: 10, marginTop: 12 }]}>
          <Score label="Workday 1 - data review" value={r.t1} />
          <Score label="Workday 2 - inbox" value={r.t2} />
        </View>
        {!r.scores_final && <Text style={[s.muted, s.small, { marginTop: 4 }]}>Scores are shown when the assessor review is complete.</Text>}

        <Text style={s.h2}>Critical flags</Text>
        <View style={s.card}>
          {r.gates.map((g, i) => (
            <View key={g.gate_id} style={[s.row, { paddingVertical: 4, borderTopWidth: i ? 1 : 0, borderTopColor: LINE }]}>
              <Text style={{ width: 26, fontFamily: 'Helvetica-Bold', color: g.fired ? '#BE123C' : '#047857' }}>{g.gate_id}</Text>
              <View style={{ flex: 1 }}>
                <Text>{ascii(g.label)} - {g.fired ? (g.held ? 'held for review' : 'triggered') : 'not triggered'}</Text>
                <Text style={[s.muted, s.small]}>{ascii(g.explanation)}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.h2}>Competencies</Text>
        <View style={s.card}>
          {r.competencies.map((c) => (
            <View key={c.id} style={{ paddingVertical: 3 }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text>
                  {c.id} {ascii(c.name)}
                </Text>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{c.reportable && c.score !== null ? Math.round(c.score) : 'Not reportable'}</Text>
              </View>
              {c.reportable && c.score !== null && (
                <View style={s.track}>
                  <View style={[s.bar, { width: `${c.score}%` }]} />
                </View>
              )}
            </View>
          ))}
        </View>
        <View style={s.footer} fixed>
          <Text>Generated {fmt(d.generatedAt)} - attempt {d.attempt.id.slice(0, 8)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Evidence summary - Workday 1</Text>
        <View style={s.card}>
          <Text>
            Time on Workday 1: {mins(t1.duration_min)} - findings logged: {t1.findings.filter((f) => !f.withdrawn).length} - records opened: {t1.records_opened.length} of 12
          </Text>
          {t1.safety_signal && (
            <Text style={{ marginTop: 4 }}>
              Safety signal ({t1.safety_signal.participant_id}): opened at +{mins(t1.safety_signal.first_open_min)}, escalated {t1.safety_signal.first_escalation_min === null ? 'never' : `at +${mins(t1.safety_signal.first_escalation_min)} to ${ascii(t1.safety_signal.escalated_to.join(', '))}`}.
            </Text>
          )}
        </View>
        {t1.findings
          .filter((f) => !f.withdrawn)
          .slice(0, 14)
          .map((f) => (
            <View key={f.id} style={{ marginTop: 6 }} wrap={false}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                {f.id} - {ascii(f.target)}
                {f.location ? ` - ${ascii(f.location)}` : ''}
              </Text>
              <Text style={s.muted}>
                {ascii(f.finding_type)}
                {f.severity ? ` - ${ascii(f.severity)}` : ''}
              </Text>
              {f.observed_issue ? <Text>{ascii(f.observed_issue)}</Text> : null}
            </View>
          ))}

        <Text style={s.h2}>Evidence summary - Workday 2</Text>
        <View style={s.card}>
          <Text>SAE report request: {t2.decisions.sae ? ascii(t2.decisions.sae.label ?? t2.decisions.sae.value) : 'no decision'}</Text>
          <Text>Screening waiver request: {t2.decisions.waiver ? ascii(t2.decisions.waiver.label ?? t2.decisions.waiver.value) : 'no decision'}</Text>
          <Text>Other messages sent: {t2.messages.length}</Text>
        </View>
        <Text style={[s.h2, { fontSize: 11 }]}>Reply to the sponsor</Text>
        <View style={s.card}>{t2.reply ? <Text>{ascii(t2.reply.body)}</Text> : <Text style={s.muted}>No reply sent.</Text>}</View>
        <View style={s.footer} fixed>
          <Text>Lokus - work-simulation assessments</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(input: ReportInput): Promise<Buffer> {
  return renderToBuffer(<ReportDocument {...input} />);
}
