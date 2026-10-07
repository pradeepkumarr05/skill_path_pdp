import { cloneElement, isValidElement, FormEvent, useId, useMemo, useState } from 'react';
import type { ReactNode, ReactElement } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle,
  FileArrowUp,
  GraduationCap,
  LockSimple,
  PencilSimple,
  SealCheck,
  Stack,
  UserCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import type { LoginMethod } from './LoginPage';
import { uploadDocument } from '../api/skillpathApi';

interface ProfileSetupPageProps {
  initialProfile?: ProfileSetupResult;
  initialName?: string;
  saving?: boolean;
  initialEmail?: string;
  lastLoginMethod: LoginMethod | null;
  onBack: () => void;
  onComplete: (profile: ProfileSetupResult) => void;
}

type Gender = 'Female' | 'Male' | 'Non-binary' | 'Prefer not to say';
type Qualification = 'High School' | 'Diploma' | 'Bachelor Degree' | 'Master Degree' | 'Doctorate';
type Domain = 'Full Stack Engineering' | 'Data Science and AI' | 'DevOps and Cloud' | 'Cybersecurity' | 'Mobile Engineering' | 'Networks and IoT';

export interface ProfileSetupResult {
  setup?: Record<string, string>;
  name: string;
  email: string;
  qualification: Qualification;
  domain: Domain;
  interestedRoles: string[];
  claimedSkills: string[];
  resumeFileName?: string;
  transcriptFileName?: string;
}

const genderOptions: Gender[] = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
const qualificationOptions: Qualification[] = ['High School', 'Diploma', 'Bachelor Degree', 'Master Degree', 'Doctorate'];

const collegeOptions = [
  'Indian Institute of Technology Bombay',
  'Indian Institute of Technology Delhi',
  'Indian Institute of Science Bengaluru',
  'National Institute of Technology Tiruchirappalli',
  'Birla Institute of Technology and Science Pilani',
  'Vellore Institute of Technology',
  'Manipal Institute of Technology',
  'Anna University',
  'Delhi University',
  'Mumbai University',
  'Savitribai Phule Pune University',
  'Other',
];

const cityOptions = ['Bengaluru', 'Chennai', 'Delhi NCR', 'Hyderabad', 'Mumbai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Other'];
const degreeOptions = ['Diploma', 'B.Tech', 'B.E.', 'B.Sc', 'BCA', 'M.Tech', 'M.E.', 'M.Sc', 'MCA', 'PhD', 'Other'];
const ugDegreeOptions = ['B.Tech', 'B.E.', 'B.Sc', 'BCA', 'B.Voc', 'Other'];
const branchOptions = [
  'Computer Science and Engineering',
  'Information Technology',
  'Electronics and Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Data Science',
  'Artificial Intelligence and Machine Learning',
  'Cybersecurity',
  'Other',
];
const boardOptions = ['CBSE', 'ICSE', 'State Board', 'NIOS', 'IB', 'Other'];
const years = Array.from({ length: 18 }, (_, index) => String(2028 - index));

const domainOptions: Domain[] = ['Full Stack Engineering'];

const rolesByDomain: Record<Domain, string[]> = {
  'Full Stack Engineering': ['Full Stack Developer Trainee', 'Associate Software Engineer', 'Junior MERN Developer', 'Product Engineering Intern'],
  'Data Science and AI': ['Data Analyst Trainee', 'Junior Data Scientist', 'ML Engineer Trainee', 'AI Application Developer'],
  'DevOps and Cloud': ['Cloud Engineer Trainee', 'DevOps Engineer Trainee', 'Junior SRE', 'Infrastructure Support Engineer'],
  Cybersecurity: ['Security Analyst Trainee', 'SOC Analyst L1', 'Junior Application Security Analyst', 'Cloud Security Trainee'],
  'Mobile Engineering': ['Android Developer Trainee', 'iOS Developer Trainee', 'React Native Developer', 'Flutter Developer Trainee'],
  'Networks and IoT': ['Network Engineer Trainee', 'IoT Developer Trainee', 'Embedded Systems Trainee', 'NOC Engineer L1'],
};

const skillsByDomain: Record<Domain, string[]> = {
  'Full Stack Engineering': ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'REST APIs', 'Data Structures and Algorithms', 'PostgreSQL', 'MongoDB', 'Git'],
  'Data Science and AI': ['Python', 'SQL', 'Pandas', 'NumPy', 'Data Visualization', 'Machine Learning Basics', 'Statistics', 'Prompting', 'Model Evaluation'],
  'DevOps and Cloud': ['Linux', 'Docker', 'AWS Basics', 'CI/CD', 'GitHub Actions', 'Networking Basics', 'Shell Scripting', 'Monitoring Basics'],
  Cybersecurity: ['Linux', 'Network Security', 'OWASP Basics', 'Threat Modeling', 'SIEM Basics', 'Python Scripting', 'Incident Response Basics'],
  'Mobile Engineering': ['Kotlin', 'Swift Basics', 'React Native', 'Flutter', 'Mobile UI', 'State Management', 'API Integration', 'App Release Basics'],
  'Networks and IoT': ['Computer Networks', 'TCP/IP', 'Routing and Switching', 'Linux', 'Arduino', 'Raspberry Pi', 'MQTT', 'Sensors', 'Embedded C'],
};

const degreeDurationYears: Record<string, number> = {
  Diploma: 3, 'B.Tech': 4, 'B.E.': 4, 'B.Sc': 3, BCA: 3,
  'M.Tech': 2, 'M.E.': 2, 'M.Sc': 2, MCA: 2, PhD: 5, Other: 3,
};

export function ProfileSetupPage({
  initialEmail, initialProfile, initialName, saving, lastLoginMethod, onBack, onComplete,
}: ProfileSetupPageProps) {
  const saved = initialProfile?.setup || {};
  const [firstName, setFirstName] = useState(saved.firstName || initialName?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(saved.lastName || initialName?.split(' ').slice(1).join(' ') || '');
  const [age, setAge] = useState(saved.age || '');
  const [gender, setGender] = useState<Gender>((saved.gender as Gender) || 'Prefer not to say');
  const [email, setEmail] = useState(initialEmail || '');
  const [qualification, setQualification] = useState<Qualification>(initialProfile?.qualification || 'Bachelor Degree');
  const [collegeName, setCollegeName] = useState(saved.collegeName || '');
  const [customCollegeName, setCustomCollegeName] = useState(saved.customCollegeName || '');
  const [collegeCity, setCollegeCity] = useState(saved.collegeCity || '');
  const [degree, setDegree] = useState(saved.degree || 'B.Tech');
  const [branch, setBranch] = useState(saved.branch || 'Computer Science and Engineering');
  const [ugDegree, setUgDegree] = useState(saved.ugDegree || 'B.Tech');
  const [ugBranch, setUgBranch] = useState(saved.ugBranch || 'Computer Science and Engineering');
  const [cgpa, setCgpa] = useState(saved.cgpa || '');
  const [startYear, setStartYear] = useState(saved.startYear || '');
  const [endYear, setEndYear] = useState(saved.endYear || '');
  const [tenthPercentage, setTenthPercentage] = useState(saved.tenthPercentage || '');
  const [twelfthPercentage, setTwelfthPercentage] = useState(saved.twelfthPercentage || '');
  const [board, setBoard] = useState(saved.board || 'CBSE');
  const [domain, setDomain] = useState<Domain>(initialProfile?.domain || 'Full Stack Engineering');
  const [interestedRoles, setInterestedRoles] = useState<string[]>(initialProfile?.interestedRoles || []);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(initialProfile?.claimedSkills || []);
  const [noExistingSkills, setNoExistingSkills] = useState(initialProfile?.claimedSkills.length === 0);
  const [customSkill, setCustomSkill] = useState('');
  const [resumeFileName, setResumeFileName] = useState(saved.resumeFileName || '');
  const [transcriptFileName, setTranscriptFileName] = useState(saved.transcriptFileName || '');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const locked = Boolean(saving);

  const isHighSchool = qualification === 'High School';
  const needsUgDetails = degree.startsWith('M') || qualification === 'Master Degree';
  const currentRoles = rolesByDomain[domain];
  const currentSkills = skillsByDomain[domain];
  const resolvedCollegeName = collegeName === 'Other' ? customCollegeName : collegeName;
  const expectedDuration = degreeDurationYears[degree] ?? 3;
  const studyDuration = Number(endYear) - Number(startYear);
  const validStudyDuration = isHighSchool || studyDuration === expectedDuration;
  const fieldsDisabled = locked || reviewOpen;
  const claimedSkills = noExistingSkills ? [] : selectedSkills;

  const completion = useMemo(() => {
    const commonFields = [firstName, lastName, age, email, qualification, domain];
    const educationFields = isHighSchool
      ? [tenthPercentage, twelfthPercentage, board]
      : [resolvedCollegeName, collegeCity, degree, branch, cgpa, startYear, endYear, validStudyDuration ? 'valid' : '', needsUgDetails ? ugDegree : 'ug-na', needsUgDetails ? ugBranch : 'ug-na'];
    const choiceFields = [interestedRoles.length ? 'roles' : '', noExistingSkills || selectedSkills.length ? 'skills' : ''];
    const allFields = [...commonFields, ...educationFields, ...choiceFields];
    const completed = allFields.filter(v => String(v).trim().length > 0).length;
    return Math.round((completed / allFields.length) * 100);
  }, [age, board, branch, cgpa, collegeCity, degree, domain, email, endYear, firstName, gender, interestedRoles.length, isHighSchool, lastName, needsUgDetails, noExistingSkills, qualification, resolvedCollegeName, selectedSkills.length, startYear, tenthPercentage, twelfthPercentage, ugBranch, ugDegree, validStudyDuration]);

  const canSubmit =
    firstName.trim().length > 1 &&
    lastName.trim().length > 1 &&
    Number(age) >= 13 && Number(age) <= 100 &&
    email.includes('@') &&
    interestedRoles.length > 0 &&
    (noExistingSkills || selectedSkills.length > 0) &&
    (isHighSchool
      ? Number(tenthPercentage) > 0 && Number(tenthPercentage) <= 100 && Number(twelfthPercentage) > 0 && Number(twelfthPercentage) <= 100 && board.length > 0
      : resolvedCollegeName.trim().length > 1 && collegeCity.length > 0 && degree.length > 0 && branch.length > 0 && Number(cgpa) > 0 && Number(cgpa) <= 10 && startYear.length > 0 && endYear.length > 0 && validStudyDuration && (!needsUgDetails || (ugDegree.length > 0 && ugBranch.length > 0)));

  const toggleRole = (role: string) => { if (fieldsDisabled) return; setInterestedRoles(cur => cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role]); };
  const toggleSkill = (skill: string) => { if (fieldsDisabled || noExistingSkills) return; setSelectedSkills(cur => cur.includes(skill) ? cur.filter(s => s !== skill) : [...cur, skill]); };
  const toggleNoExistingSkills = () => { if (fieldsDisabled) return; setNoExistingSkills(cur => { const next = !cur; if (next) { setSelectedSkills([]); setCustomSkill(''); } return next; }); };
  const addCustomSkill = () => { const s = customSkill.trim(); if (!s || selectedSkills.includes(s) || fieldsDisabled || noExistingSkills) return; setSelectedSkills(cur => [...cur, s]); setCustomSkill(''); };
  const handleDomainChange = (next: Domain) => { if (fieldsDisabled) return; setDomain(next); setInterestedRoles([]); setSelectedSkills([]); setNoExistingSkills(false); setCustomSkill(''); };
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (!canSubmit || locked) return; setReviewOpen(true); };
  const profileResult: ProfileSetupResult = {
    setup: { firstName, lastName, age, gender, collegeName, customCollegeName, collegeCity, degree, branch, ugDegree, ugBranch, cgpa, startYear, endYear, tenthPercentage, twelfthPercentage, board },
    name: `${firstName} ${lastName}`.trim(), email, qualification, domain, interestedRoles, claimedSkills,
    resumeFileName: resumeFileName || undefined, transcriptFileName: transcriptFileName || undefined,
  };
  const confirmSubmission = () => { if (!canSubmit || saving) return; onComplete(profileResult); };
  const editSubmission = () => { if (locked) return; setReviewOpen(false); };

  return (
    <div className="sp-page">
      {/* HEADER */}
      <header className="sp-header">
        <span className="sp-logo-script">SkillPath</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--sp-muted)', marginBottom: 6 }}>
              <span>Profile setup</span>
              <span>{completion}%</span>
            </div>
            <div className="sp-progress">
              <div className="sp-progress-fill" style={{ width: `${completion}%` }} />
            </div>
          </div>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
              borderRadius: 999, background: 'var(--sp-sage-dim)', color: 'var(--sp-sage)',
              fontSize: 12, fontWeight: 700,
            }}
          >
            Profile setup
          </span>
        </div>
      </header>

      <div className="sp-content">
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gap: 24,
            gridTemplateColumns: 'minmax(0,1fr) minmax(280px,360px)',
          }}
        >
          {/* LEFT — MAIN FORM */}
          <section style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--sp-ink)', margin: 0 }}>Profile setup</h1>
                <p style={{ marginTop: 6, fontSize: 14, color: 'var(--sp-muted)', maxWidth: 480 }}>
                  Name, age, education, and a target role are required. Gender and PDF documents are optional. Select your existing skills or choose None yet.
                </p>
              </div>
              <button
                type="button"
                onClick={onBack}
                disabled={locked}
                className="sp-btn-secondary"
                style={{ flexShrink: 0, gap: 8 }}
              >
                <ArrowLeft size={15} weight="bold" aria-hidden />
                Back
              </button>
            </div>

            {locked && (
              <div className="sp-notice sp-notice-success sp-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <LockSimple size={16} weight="bold" aria-hidden />
                <span style={{ fontWeight: 600, fontSize: 13 }}>Saving your profile...</span>
              </div>
            )}

            <nav className="setup-tabs" aria-label="Profile sections">{['Personal details','Education','Career goals','Documents'].map((label,index)=><button type="button" key={label} aria-current={setupStep===index?'step':undefined} disabled={fieldsDisabled} onClick={()=>setSetupStep(index)}>{index+1}. {label}</button>)}</nav>
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Basic details */}
              <Card hidden={setupStep !== 0}>
                <SectionHeader icon={<UserCircle size={17} weight="bold" />} title="Basic details" />
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
                  <Field label="First name">
                    <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} disabled={fieldsDisabled} autoComplete="given-name" />
                  </Field>
                  <Field label="Last name">
                    <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} disabled={fieldsDisabled} autoComplete="family-name" />
                  </Field>
                  <Field label="Age">
                    <input style={inputStyle} type="number" min="13" max="80" value={age} onChange={e => setAge(e.target.value)} disabled={fieldsDisabled} />
                  </Field>
                  <Field label="Gender (optional)">
                    <select style={inputStyle} value={gender} onChange={e => setGender(e.target.value as Gender)} disabled={fieldsDisabled}>
                      {genderOptions.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Email" style={{ gridColumn: '1 / -1' }}>
                    <input style={inputStyle} type="email" value={email} readOnly disabled autoComplete="email" />
                  </Field>
                </div>
              </Card>

              {/* Education */}
              <Card hidden={setupStep !== 1}>
                <SectionHeader icon={<GraduationCap size={17} weight="bold" />} title="Education" />
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
                  <Field label="Qualification">
                    <select style={inputStyle} value={qualification} onChange={e => setQualification(e.target.value as Qualification)} disabled={fieldsDisabled}>
                      {qualificationOptions.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </Field>

                  {isHighSchool ? (
                    <>
                      <Field label="Board of study">
                        <select style={inputStyle} value={board} onChange={e => setBoard(e.target.value)} disabled={fieldsDisabled}>
                          {boardOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </Field>
                      <Field label="10th percentage">
                        <input style={inputStyle} type="number" min="0" max="100" value={tenthPercentage} onChange={e => setTenthPercentage(e.target.value)} disabled={fieldsDisabled} />
                      </Field>
                      <Field label="12th percentage">
                        <input style={inputStyle} type="number" min="0" max="100" value={twelfthPercentage} onChange={e => setTwelfthPercentage(e.target.value)} disabled={fieldsDisabled} />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="College">
                        <select style={inputStyle} value={collegeName} onChange={e => setCollegeName(e.target.value)} disabled={fieldsDisabled}>
                          <option value="" disabled>Select college</option>
                          {collegeOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </Field>
                      {collegeName === 'Other' && (
                        <Field label="College name" style={{ gridColumn: '1 / -1' }}>
                          <input style={inputStyle} value={customCollegeName} onChange={e => setCustomCollegeName(e.target.value)} disabled={fieldsDisabled} />
                        </Field>
                      )}
                      <Field label="City">
                        <select style={inputStyle} value={collegeCity} onChange={e => setCollegeCity(e.target.value)} disabled={fieldsDisabled}>
                          <option value="" disabled>Select city</option>
                          {cityOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </Field>
                      <Field label="Degree">
                        <select style={inputStyle} value={degree} onChange={e => setDegree(e.target.value)} disabled={fieldsDisabled}>
                          {degreeOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </Field>
                      <Field label="Branch">
                        <select style={inputStyle} value={branch} onChange={e => setBranch(e.target.value)} disabled={fieldsDisabled}>
                          {branchOptions.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </Field>
                      {needsUgDetails && (
                        <>
                          <Field label="UG degree">
                            <select style={inputStyle} value={ugDegree} onChange={e => setUgDegree(e.target.value)} disabled={fieldsDisabled}>
                              {ugDegreeOptions.map(o => <option key={o}>{o}</option>)}
                            </select>
                          </Field>
                          <Field label="UG branch">
                            <select style={inputStyle} value={ugBranch} onChange={e => setUgBranch(e.target.value)} disabled={fieldsDisabled}>
                              {branchOptions.map(o => <option key={o}>{o}</option>)}
                            </select>
                          </Field>
                        </>
                      )}
                      <Field label="CGPA">
                        <input style={inputStyle} type="number" min="0" max="10" step="0.1" value={cgpa} onChange={e => setCgpa(e.target.value)} disabled={fieldsDisabled} />
                      </Field>
                      <Field label="Start year">
                        <select style={inputStyle} value={startYear} onChange={e => setStartYear(e.target.value)} disabled={fieldsDisabled}>
                          <option value="" disabled>Year</option>
                          {years.map(y => <option key={y}>{y}</option>)}
                        </select>
                      </Field>
                      <Field label="End year">
                        <select style={inputStyle} value={endYear} onChange={e => setEndYear(e.target.value)} disabled={fieldsDisabled}>
                          <option value="" disabled>Year</option>
                          {years.map(y => <option key={y}>{y}</option>)}
                        </select>
                      </Field>
                      {!validStudyDuration && (
                        <div className="sp-notice sp-notice-warn" style={{ gridColumn: '1 / -1' }}>
                          Selected degree expects a {expectedDuration}-year study period.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Card>

              {/* Documents */}
              <Card hidden={setupStep !== 3}>
                <SectionHeader icon={<FileArrowUp size={17} weight="bold" />} title="Documents" />
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                  <FileField label="Resume" fileName={resumeFileName} disabled={fieldsDisabled} onChange={setResumeFileName} />
                  <FileField label="Academic transcript" fileName={transcriptFileName} disabled={fieldsDisabled} onChange={setTranscriptFileName} />
                </div>
              </Card>

              {/* Domain & roles */}
              <Card hidden={setupStep !== 2}>
                <SectionHeader icon={<Briefcase size={17} weight="bold" />} title="Domain and roles" />
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'minmax(200px,280px) minmax(0,1fr)', gap: 20 }}>
                  <div>
                    <p className="sp-label" style={{ marginBottom: 10 }}>Domain</p>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {(initialProfile?.domain && initialProfile.domain !== 'Full Stack Engineering' ? [initialProfile.domain, ...domainOptions] : domainOptions).map(option => (
                        <ChoiceButton key={option} label={option} selected={domain === option} disabled={fieldsDisabled} onClick={() => handleDomainChange(option)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="sp-label" style={{ marginBottom: 10 }}>Interested roles</p>
                    <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
                      {currentRoles.map(role => (
                        <ChoiceButton key={role} label={role} selected={interestedRoles.includes(role)} disabled={fieldsDisabled} onClick={() => toggleRole(role)} />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Skills */}
              <Card hidden={setupStep !== 2}>
                <SectionHeader icon={<Stack size={17} weight="bold" />} title="Existing skills" />
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ marginBottom: 12 }}>
                    <ChoiceButton label="None yet" selected={noExistingSkills} disabled={fieldsDisabled} onClick={toggleNoExistingSkills} />
                  </div>
                  <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
                    {currentSkills.map(skill => (
                      <ChoiceButton key={skill} label={skill} selected={selectedSkills.includes(skill)} disabled={fieldsDisabled || noExistingSkills} onClick={() => toggleSkill(skill)} />
                    ))}
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                    <input
                      style={{ ...inputStyle, height: 40 }}
                      value={customSkill}
                      onChange={e => setCustomSkill(e.target.value)}
                      placeholder="Add a custom skill"
                      disabled={fieldsDisabled || noExistingSkills}
                    />
                    <button
                      type="button"
                      className="sp-btn-accent"
                      style={{ flexShrink: 0, height: 40, padding: '0 18px', fontSize: 13 }}
                      onClick={addCustomSkill}
                      disabled={fieldsDisabled || noExistingSkills || customSkill.trim().length === 0}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </Card>
            </div>
            <div className="action-row" style={{justifyContent:'space-between',marginTop:24}}><button type="button" className="sp-btn-secondary" disabled={setupStep===0||fieldsDisabled} onClick={()=>setSetupStep(s=>s-1)}><ArrowLeft size={18} />Previous</button><button type="button" className="sp-btn-primary" disabled={setupStep===3||fieldsDisabled} onClick={()=>setSetupStep(s=>s+1)}>Next section<ArrowRight size={18} /></button></div>
          </section>

          {/* RIGHT — SIDEBAR */}
          <aside style={{ position: 'sticky', top: 76, alignSelf: 'start', minWidth: 0 }}>
            <div className="sp-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sp-ink)', margin: 0 }}>
                  {reviewOpen ? 'Final review' : 'Setup status'}
                </h2>
                <CheckCircle size={22} weight={locked ? 'fill' : 'bold'} color={locked ? 'var(--sp-sage)' : 'var(--sp-muted)'} aria-hidden />
              </div>

              {reviewOpen ? (
                <>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {([
                      ['Name', `${firstName} ${lastName}`.trim() || 'Required'],
                      ['Age / Gender', `${age}, ${gender}`],
                      ['Email', email || 'Required'],
                      ['Education', isHighSchool ? `${board}, 10th ${tenthPercentage}%, 12th ${twelfthPercentage}%` : `${degree}, ${branch}`],
                      ['College', isHighSchool ? 'High school' : resolvedCollegeName || 'Required'],
                      ['Study period', isHighSchool ? 'School' : `${startYear} to ${endYear}`],
                      ['Domain', domain],
                      ['Roles', interestedRoles.length ? interestedRoles.join(', ') : 'Select at least one'],
                      ['Skills', noExistingSkills ? 'None yet' : selectedSkills.length ? selectedSkills.join(', ') : 'Select at least one'],
                      ['Resume', resumeFileName || 'Not uploaded'],
                      ['Transcript', transcriptFileName || 'Not uploaded'],
                    ] as [string, string][]).map(([label, value]) => (
                      <SummaryRow key={label} label={label} value={value} />
                    ))}
                  </div>

                  <div style={{
                    marginTop: 16, padding: 14, borderRadius: 8,
                    background: 'var(--sp-panel)', border: '1px solid var(--sp-border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                      {locked
                        ? <SealCheck size={17} weight="fill" color="var(--sp-sage)" aria-hidden />
                        : <PencilSimple size={17} weight="bold" color="var(--sp-muted)" aria-hidden />}
                      <p style={{ fontSize: 13, color: 'var(--sp-body)', fontWeight: 600, lineHeight: 1.5 }}>
                        {locked
                          ? 'Saving your changes.'
                          : 'Review your details before saving. You can update your profile later.'}
                      </p>
                    </div>
                    {!locked ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button type="button" className="sp-btn-secondary" style={{ height: 40, fontSize: 13 }} onClick={editSubmission}>Edit</button>
                        <button type="button" className="sp-btn-accent" style={{ height: 40, fontSize: 13 }} onClick={confirmSubmission}>Save profile</button>
                      </div>
                    ) : (
                      <button type="button" disabled className="sp-btn-accent" style={{ width: '100%', height: 40, fontSize: 13 }}>
                        Saving...
                        <ArrowRight size={15} weight="bold" aria-hidden />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
                    <StatusRow label="Basic details" done={firstName.trim().length > 1 && lastName.trim().length > 1 && email.includes('@')} />
                    <StatusRow label="Education" done={isHighSchool ? Number(tenthPercentage) > 0 && Number(twelfthPercentage) > 0 : resolvedCollegeName.trim().length > 1 && Number(cgpa) > 0 && validStudyDuration} />
                    <StatusRow label="Domain and roles" done={interestedRoles.length > 0} />
                    <StatusRow label="Existing skills" done={noExistingSkills || selectedSkills.length > 0} />
                  </div>
                  {!canSubmit && (
                    <div className="sp-notice sp-notice-danger" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                      <WarningCircle size={16} weight="bold" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                      <span>Complete all required fields before review.</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="sp-btn-primary"
                    style={{ width: '100%', height: 44, fontSize: 14 }}
                    disabled={!canSubmit}
                  >
                    Review profile
                    <ArrowRight size={15} weight="bold" aria-hidden />
                  </button>
                </>
              )}
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

/* ── Shared sub-components ── */

const inputStyle: React.CSSProperties = {
  height: 42,
  padding: '0 13px',
  borderRadius: 8,
  fontSize: 14,
};

function Card({ children, hidden = false }: { children: ReactNode; hidden?: boolean }) {
  return (
    <div hidden={hidden} className="setup-section" style={{ overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="sp-section-header">
      <div className="sp-section-icon">{icon}</div>
      <span className="sp-section-title">{title}</span>
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: ReactNode; style?: React.CSSProperties }) {
  const id = useId();
  return (
    <div style={style}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sp-body)', marginBottom: 6 }}>{label}</label>
      {isValidElement(children) ? cloneElement(children as ReactElement<{ id: string }>, { id }) : children}
    </div>
  );
}

function FileField({ label, fileName, disabled, onChange }: { label: string; fileName: string; disabled: boolean; onChange: (f: string) => void }) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  return (
    <label style={{
      display: 'block', padding: '14px 14px', borderRadius: 8,
      background: 'var(--sp-panel)', border: '1px solid var(--sp-border)', cursor: 'pointer',
    }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sp-body)', marginBottom: 10 }}>{label}</span>
      <input
        style={{
          display: 'block', width: '100%', fontSize: 13, fontWeight: 500,
          color: 'var(--sp-body)', border: 'none', background: 'transparent',
          padding: 0, height: 'auto', borderRadius: 0,
        }}
        type="file"
        accept=".pdf,application/pdf"
        disabled={disabled || uploading}
        onChange={async e => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          setError(''); onChange('');
          if (!file) return;
          const signature = await file.slice(0, 5).text();
          if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf') || signature !== '%PDF-' || file.size > 5 * 1024 * 1024) {
            setError('Valid PDF required, max 5 MB.'); input.value = ''; return;
          }
          setUploading(true);
          try { const res = await uploadDocument(file, label === 'Resume' ? 'resume' : 'transcript'); onChange(res.filename); }
          catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); input.value = ''; }
          finally { setUploading(false); }
        }}
      />
      <span style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--sp-muted)' }}>
        {uploading ? 'Uploading...' : fileName || 'Optional. PDF only, max 5 MB.'}
      </span>
      {error && <span role="alert" style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--sp-danger)' }}>{error}</span>}
    </label>
  );
}

function ChoiceButton({ label, selected, disabled, onClick }: { label: string; selected: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`sp-choice${selected ? ' selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span style={{ fontSize: 13 }}>{label}</span>
      {selected && <Check size={14} weight="bold" aria-hidden />}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8,
      background: 'var(--sp-surface)', border: '1px solid var(--sp-border)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sp-muted)' }}>{label}</p>
      <p style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: 'var(--sp-ink)', overflowWrap: 'anywhere' }}>{value}</p>
    </div>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '10px 12px', borderRadius: 8,
      background: done ? 'var(--sp-sage-dim)' : 'var(--sp-panel)',
      border: `1px solid ${done ? 'rgba(74,124,89,0.25)' : 'var(--sp-border)'}`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: done ? 'var(--sp-sage)' : 'var(--sp-body)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: done ? 'var(--sp-sage)' : 'var(--sp-ghost)' }}>
        {done ? 'Done' : 'Open'}
      </span>
    </div>
  );
}
