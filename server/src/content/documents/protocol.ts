import { STUDY } from '../study';
import type { StudyDocument } from '../types';
import { VISIT_SCHEDULE, windowLabel } from '../visits';

/**
 * Protocol extract v2.1 (workbook F1, F3, F4). Reference codes PRO-026-A..F live inside the sections they
 * govern so candidates can cite them. Visit windows are generated from VISIT_SCHEDULE.
 */
export const PROTOCOL: StudyDocument = {
  id: 'protocol',
  title: 'Clinical Study Protocol — Extract',
  shortTitle: 'Protocol extract',
  subtitle: STUDY.title,
  version: STUDY.protocolVersion,
  status: 'Approved protocol · extract prepared for CRO quality-control use',
  owner: STUDY.sponsor,
  header: [
    { label: 'Study ID', value: STUDY.id },
    { label: 'Study phase', value: STUDY.phase },
    { label: 'Sponsor', value: STUDY.sponsor },
    { label: 'Protocol version', value: `${STUDY.protocolVersion} (${STUDY.protocolDate})` },
    { label: 'Investigational treatment', value: `${STUDY.product} — ${STUDY.dose}` },
    { label: 'Comparator', value: STUDY.comparator },
  ],
  sections: [
    {
      id: '1',
      number: '1',
      title: 'Study visit schedule',
      blocks: [
        {
          type: 'clause',
          code: 'PRO-026-A',
          title: 'Visit schedule and permitted windows',
          blocks: [
            {
              type: 'p',
              text: 'Each participant attends seven visits over 12 weeks. A visit is within its window when the actual visit date is no more than the permitted number of days before or after the planned visit date recorded on the CRF. Window limits are inclusive.',
            },
            {
              type: 'table',
              headers: ['Visit', 'Target', 'Study day', 'Permitted window'],
              rows: VISIT_SCHEDULE.map((v) => [`Visit ${v.visitNumber}`, `Week ${v.week}`, `Day ${v.studyDay}`, windowLabel(v)]),
            },
            {
              type: 'p',
              text: 'A visit outside its permitted window is a visit date deviation. Document it with the supporting evidence and raise a query to the site; do not change source dates.',
            },
            {
              type: 'note',
              text: 'The CRF extract supplied for quality-control review records Visits 1, 4, 6 and 7 (Weeks 0, 4, 8 and 12). Visits 2, 3 and 5 are captured in separate source documents and are outside the scope of this review.',
            },
          ],
        },
      ],
    },
    {
      id: '2',
      number: '2',
      title: 'Study treatment',
      blocks: [
        {
          type: 'clause',
          code: 'PRO-026-B',
          title: 'Investigational product dosing and recording',
          blocks: [
            { type: 'p', text: `${STUDY.product} is taken as one 50 mg tablet by mouth once daily, in the morning. The comparator is a matching placebo taken once daily.` },
            {
              type: 'list',
              items: [
                'Every administered dose is recorded in milligrams (mg).',
                'Dose entries in any other unit (for example micrograms: µg, ug or mcg) are erroneous and require clarification with the site.',
                'Dose changes or interruptions must be documented with the reason and reported to the sponsor.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: '3',
      number: '3',
      title: 'Prohibited medicines',
      blocks: [
        {
          type: 'clause',
          code: 'PRO-026-C',
          title: 'Prohibited concomitant medicines and washout',
          blocks: [
            {
              type: 'list',
              items: [
                'Other SGLT-2 inhibitors (for example empagliflozin, dapagliflozin, canagliflozin) are not permitted during the study.',
                'Systemic glucocorticoids require a 30-day washout before screening.',
                'Starting a new non-study diabetes medicine during the 12-week treatment period requires prior Medical Monitor approval.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: '4',
      number: '4',
      title: 'Assessments and fasting conditions',
      blocks: [
        {
          type: 'clause',
          code: 'PRO-026-D',
          title: 'Assessment sequence and fasting',
          blocks: [
            {
              type: 'list',
              items: [
                'Fasting blood glucose samples require at least an 8-hour overnight fast.',
                'Blood pressure is measured seated after at least 5 minutes of rest, using the same arm at every visit.',
                'Vital signs are recorded before blood collection and before the morning dose of study treatment.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: '5',
      number: '5',
      title: 'Eligibility (selected criteria)',
      blocks: [
        {
          type: 'clause',
          code: 'PRO-026-F',
          title: 'Eligibility criteria and exceptions',
          blocks: [
            {
              type: 'list',
              items: [
                'Adults aged 18–65 years with Type 2 diabetes.',
                'Serum creatinine ≤ 1.30 mg/dL at screening.',
                'No other SGLT-2 inhibitor in the 30 days before screening.',
              ],
            },
            {
              type: 'p',
              text: 'Eligibility criteria may not be waived informally. A request for an eligibility exception must be made in writing to the Medical Monitor, who is the authorised decision-maker, and any exception granted is documented as a protocol deviation. Site, sponsor operations and CRO operational staff cannot grant eligibility exceptions.',
            },
          ],
        },
      ],
    },
    {
      id: '6',
      number: '6',
      title: 'Safety',
      blocks: [
        {
          type: 'clause',
          code: 'PRO-026-E',
          title: 'Adverse events, safety escalation and SAE reporting',
          blocks: [
            {
              type: 'list',
              items: [
                'Any untoward medical occurrence after the first dose, whether or not it is considered related to study treatment, must be recorded as an adverse event on the AE field of the CRF. Symptoms that appear only in free-text comments must be followed up and assessed as potential adverse events.',
                'Systolic blood pressure above 160 mmHg, diastolic blood pressure above 100 mmHg, or blood glucose below 70 mg/dL requires immediate clinical review.',
                'Potential safety concerns identified during data review must not be handled solely as routine data queries. Escalate them promptly through the internal safety escalation pathway (Clinical Project Manager and Medical Monitor) and document the escalation.',
                'Serious adverse events (death, a life-threatening event, hospitalisation or prolonged hospitalisation, persistent disability, a congenital anomaly, or another medically important event) must be reported by the site to the sponsor safety desk within 24 hours of the site becoming aware.',
                'SAE reporting timelines apply regardless of data cuts, database locks or interim analyses. Safety follow-up continues until 30 days after the last dose of study treatment.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: '7',
      number: '7',
      title: 'Data recording requirements',
      blocks: [
        {
          type: 'list',
          items: [
            'Each participant has a unique participant ID, a valid site ID and a visit number for every visit.',
            'Consent must be obtained and dated before any study-specific procedure.',
            'Blood glucose is recorded in mg/dL, body weight in kg and blood pressure in mmHg (see the data specification, DSU-026).',
            'Required fields must not be left blank without a documented explanation.',
            'Original source values are never overwritten during quality-control review. Record the concern, the supporting evidence and the recommended follow-up instead.',
          ],
        },
      ],
    },
    {
      id: '8',
      number: '8',
      title: 'Document review and approval',
      blocks: [
        {
          type: 'p',
          text: 'A claim that a document section was previously approved is not, by itself, evidence of approval. Check the document’s version and approval status. Record concerns and request verification where necessary. Do not alter or approve a controlled document without authority.',
        },
      ],
    },
    {
      id: '9',
      number: '9',
      title: 'Data queries',
      blocks: [
        {
          type: 'p',
          text: 'Queries to sites must be neutral and non-leading. Identify the participant, visit and field, state the observed inconsistency, and request verification or clarification. Do not suggest an answer the evidence does not support. Source data stays unchanged until an authorised resolution.',
        },
      ],
    },
    {
      id: '10',
      number: '10',
      title: 'Scope of this extract',
      blocks: [
        {
          type: 'note',
          text: 'Fictional training material prepared for the NorthrSim simulation. This extract is not an approved clinical protocol and is not suitable for clinical decision-making.',
        },
      ],
    },
  ],
  footer: `${STUDY.id} · Protocol extract v${STUDY.protocolVersion} · ${STUDY.sponsor} · Fictional training material`,
};
