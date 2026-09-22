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
import { SkillPathLogo } from '../components/SkillPathLogo';
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

const domainOptions: Domain[] = ['Full Stack Engineering', 'Data Science and AI', 'DevOps and Cloud', 'Cybersecurity', 'Mobile Engineering', 'Networks and IoT'];

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
  Diploma: 3,
  'B.Tech': 4,
  'B.E.': 4,
  'B.Sc': 3,
  BCA: 3,
  'M.Tech': 2,
  'M.E.': 2,
  'M.Sc': 2,
  MCA: 2,
  PhD: 5,
  Other: 3,
};

const inputClass =
  'h-12 w-full rounded-md border border-white/12 bg-white/8 px-4 text-base font-bold text-skillpath-cream shadow-soft transition placeholder:text-skillpath-cream/45 focus:border-skillpath-teal disabled:cursor-not-allowed disabled:opacity-70';
const selectClass =
  'h-12 w-full rounded-md border border-white/12 bg-white/8 px-4 text-base font-bold text-skillpath-cream shadow-soft transition focus:border-skillpath-teal disabled:cursor-not-allowed disabled:opacity-70';
const cardClass = 'rounded-lg border border-white/10 bg-skillpath-night text-skillpath-cream shadow-panel';

export function ProfileSetupPage({ initialEmail, initialProfile, initialName, saving, lastLoginMethod, onBack, onComplete }: ProfileSetupPageProps) {
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
  const [locked, setLocked] = useState(false);

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
    const commonFields = [firstName, lastName, age, gender, email, qualification, domain];
    const educationFields = isHighSchool
      ? [tenthPercentage, twelfthPercentage, board]
      : [resolvedCollegeName, collegeCity, degree, branch, cgpa, startYear, endYear, validStudyDuration ? 'valid' : '', needsUgDetails ? ugDegree : 'ug-na', needsUgDetails ? ugBranch : 'ug-na'];
    const choiceFields = [interestedRoles.length ? 'roles' : '', noExistingSkills || selectedSkills.length ? 'skills' : ''];
    const allFields = [...commonFields, ...educationFields, ...choiceFields];
    const completed = allFields.filter((value) => String(value).trim().length > 0).length;
    return Math.round((completed / allFields.length) * 100);
  }, [
    age,
    board,
    branch,
    cgpa,
    collegeCity,
    degree,
    domain,
    email,
    endYear,
    firstName,
    gender,
    interestedRoles.length,
    isHighSchool,
    lastName,
    needsUgDetails,
    noExistingSkills,
    qualification,
    resolvedCollegeName,
    selectedSkills.length,
    startYear,
    tenthPercentage,
    twelfthPercentage,
    ugBranch,
    ugDegree,
    validStudyDuration,
  ]);

  const canSubmit =
    firstName.trim().length > 1 &&
    lastName.trim().length > 1 &&
    Number(age) >= 13 && Number(age) <= 100 &&
    email.includes('@') &&
    interestedRoles.length > 0 &&
    (noExistingSkills || selectedSkills.length > 0) &&
    (isHighSchool
      ? Number(tenthPercentage) > 0 && Number(tenthPercentage) <= 100 && Number(twelfthPercentage) > 0 && Number(twelfthPercentage) <= 100 && board.length > 0
      : resolvedCollegeName.trim().length > 1 &&
        collegeCity.length > 0 &&
        degree.length > 0 &&
        branch.length > 0 &&
        Number(cgpa) > 0 && Number(cgpa) <= 10 &&
        startYear.length > 0 &&
        endYear.length > 0 &&
        validStudyDuration &&
        (!needsUgDetails || (ugDegree.length > 0 && ugBranch.length > 0)));

  const toggleRole = (role: string) => {
    if (fieldsDisabled) return;
    setInterestedRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  };

  const toggleSkill = (skill: string) => {
    if (fieldsDisabled || noExistingSkills) return;
    setSelectedSkills((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));
  };

  const toggleNoExistingSkills = () => {
    if (fieldsDisabled) return;
    setNoExistingSkills((current) => {
      const next = !current;
      if (next) {
        setSelectedSkills([]);
        setCustomSkill('');
      }
      return next;
    });
  };

  const addCustomSkill = () => {
    const nextSkill = customSkill.trim();
    if (!nextSkill || selectedSkills.includes(nextSkill) || fieldsDisabled || noExistingSkills) return;
    setSelectedSkills((current) => [...current, nextSkill]);
    setCustomSkill('');
  };

  const handleDomainChange = (nextDomain: Domain) => {
    if (fieldsDisabled) return;
    setDomain(nextDomain);
    setInterestedRoles([]);
    setSelectedSkills([]);
    setNoExistingSkills(false);
    setCustomSkill('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || locked) return;
    setReviewOpen(true);
  };

  const profileResult: ProfileSetupResult = {
    setup: { firstName, lastName, age, gender, collegeName, customCollegeName, collegeCity, degree, branch, ugDegree, ugBranch, cgpa, startYear, endYear, tenthPercentage, twelfthPercentage, board },
    name: `${firstName} ${lastName}`.trim(),
    email,
    qualification,
    domain,
    interestedRoles,
    claimedSkills,
    resumeFileName: resumeFileName || undefined,
    transcriptFileName: transcriptFileName || undefined,
  };

  const confirmSubmission = () => {
    if (!canSubmit) return;
    setLocked(true);
    setReviewOpen(true);
  };

  const continueToGuidelines = () => {
    if (!locked || saving) return;
    onComplete(profileResult);
  };

  const editSubmission = () => {
    if (locked) return;
    setReviewOpen(false);
  };

  return (
    <main className="min-h-screen bg-skillpath-night p-4 text-skillpath-ink sm:p-5 lg:p-6">
      <div className="flex min-h-[calc(100vh-32px)] w-full flex-col rounded-lg border border-white/10 bg-skillpath-night shadow-panel sm:min-h-[calc(100vh-40px)] lg:min-h-[calc(100vh-48px)]">
        <header className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <SkillPathLogo />
            <span className="rounded-full bg-skillpath-teal px-3 py-1.5 text-sm font-black text-skillpath-night lg:hidden">2/4 complete</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-[240px]">
              <div className="mb-2 flex items-center justify-between text-sm font-black text-skillpath-cream">
                <span>Profile setup</span>
                <span>{completion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/14">
                <div className="h-full rounded-full bg-skillpath-teal transition-all" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
        </header>

        <form className="grid flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(330px,400px)] lg:p-8 xl:grid-cols-[minmax(0,1fr)_440px]" onSubmit={handleSubmit}>
          <section className="min-w-0">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-bold leading-tight text-skillpath-cream">Profile setup</h1>
                <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-skillpath-cream/70">
                  Tell SkillPath who you are, what you studied, and where you want to grow.
                </p>
              </div>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/14 bg-white/8 px-4 text-sm font-black text-skillpath-cream transition hover:border-skillpath-teal disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={onBack}
                disabled={locked}
              >
                <ArrowLeft className="h-4 w-4" weight="bold" aria-hidden="true" />
                Back
              </button>
            </div>

            {locked ? (
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-skillpath-teal bg-skillpath-teal p-4 text-skillpath-night">
                <LockSimple className="mt-0.5 h-5 w-5 flex-none" weight="bold" aria-hidden="true" />
                <p className="text-sm font-black">Profile submitted. Details are locked for this session.</p>
              </div>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-2">
              <section className={cardClass}>
                <SectionHeader icon={<UserCircle className="h-6 w-6" weight="bold" aria-hidden="true" />} title="Basic details" />
                <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                  <Field label="First name">
                    <input className={inputClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={fieldsDisabled} autoComplete="given-name" />
                  </Field>
                  <Field label="Last name">
                    <input className={inputClass} value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={fieldsDisabled} autoComplete="family-name" />
                  </Field>
                  <Field label="Age">
                    <input className={inputClass} type="number" min="13" max="80" value={age} onChange={(event) => setAge(event.target.value)} disabled={fieldsDisabled} />
                  </Field>
                  <Field label="Gender">
                    <select className={selectClass} value={gender} onChange={(event) => setGender(event.target.value as Gender)} disabled={fieldsDisabled}>
                      {genderOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Email ID" className="sm:col-span-2">
                    <input className={inputClass} type="email" value={email} readOnly disabled autoComplete="email" />
                  </Field>
                </div>
              </section>

              <section className={cardClass}>
                <SectionHeader icon={<GraduationCap className="h-6 w-6" weight="bold" aria-hidden="true" />} title="Education" />
                <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                  <Field label="Qualification">
                    <select className={selectClass} value={qualification} onChange={(event) => setQualification(event.target.value as Qualification)} disabled={fieldsDisabled}>
                      {qualificationOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>

                  {isHighSchool ? (
                    <>
                      <Field label="Board of study">
                        <select className={selectClass} value={board} onChange={(event) => setBoard(event.target.value)} disabled={fieldsDisabled}>
                          {boardOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="10th percentage">
                        <input className={inputClass} type="number" min="0" max="100" value={tenthPercentage} onChange={(event) => setTenthPercentage(event.target.value)} disabled={fieldsDisabled} />
                      </Field>
                      <Field label="12th percentage">
                        <input className={inputClass} type="number" min="0" max="100" value={twelfthPercentage} onChange={(event) => setTwelfthPercentage(event.target.value)} disabled={fieldsDisabled} />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="College name">
                    <select className={selectClass} value={collegeName} onChange={(event) => setCollegeName(event.target.value)} disabled={fieldsDisabled}>
                          <option value="" disabled>Select a college</option>
                          {collegeOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </Field>
                      {collegeName === 'Other' ? (
                        <Field label="Enter college name" className="sm:col-span-2">
                          <input className={inputClass} value={customCollegeName} onChange={(event) => setCustomCollegeName(event.target.value)} disabled={fieldsDisabled} />
                        </Field>
                      ) : null}
                      <Field label="College city">
                        <select className={selectClass} value={collegeCity} onChange={(event) => setCollegeCity(event.target.value)} disabled={fieldsDisabled}>
                          <option value="" disabled>Select a city</option>
                          {cityOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Degree">
                        <select className={selectClass} value={degree} onChange={(event) => setDegree(event.target.value)} disabled={fieldsDisabled}>
                          {degreeOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Branch">
                        <select className={selectClass} value={branch} onChange={(event) => setBranch(event.target.value)} disabled={fieldsDisabled}>
                          {branchOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </Field>
                      {needsUgDetails ? (
                        <>
                          <Field label="UG degree">
                            <select className={selectClass} value={ugDegree} onChange={(event) => setUgDegree(event.target.value)} disabled={fieldsDisabled}>
                              {ugDegreeOptions.map((option) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="UG branch">
                            <select className={selectClass} value={ugBranch} onChange={(event) => setUgBranch(event.target.value)} disabled={fieldsDisabled}>
                              {branchOptions.map((option) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          </Field>
                        </>
                      ) : null}
                      <Field label="CGPA">
                        <input className={inputClass} type="number" min="0" max="10" step="0.1" value={cgpa} onChange={(event) => setCgpa(event.target.value)} disabled={fieldsDisabled} />
                      </Field>
                      <Field label="Start year">
                        <select className={selectClass} value={startYear} onChange={(event) => setStartYear(event.target.value)} disabled={fieldsDisabled}>
                          <option value="" disabled>Select year</option>
                          {years.map((year) => (
                            <option key={year}>{year}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="End year">
                        <select className={selectClass} value={endYear} onChange={(event) => setEndYear(event.target.value)} disabled={fieldsDisabled}>
                          <option value="" disabled>Select year</option>
                          {years.map((year) => (
                            <option key={year}>{year}</option>
                          ))}
                        </select>
                      </Field>
                      {!validStudyDuration ? (
                        <div className="sm:col-span-2 rounded-md border border-skillpath-danger bg-white/8 p-3 text-sm font-bold text-skillpath-cream">
                          Selected degree expects a {expectedDuration}-year study period.
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </section>

              <section className={`${cardClass} xl:col-span-2`}>
                <SectionHeader icon={<FileArrowUp className="h-6 w-6" weight="bold" aria-hidden="true" />} title="Documents" />
                <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                  <FileField label="Resume" fileName={resumeFileName} disabled={fieldsDisabled} onChange={setResumeFileName} />
                  <FileField label="Academic transcript" fileName={transcriptFileName} disabled={fieldsDisabled} onChange={setTranscriptFileName} />
                </div>
              </section>

              <section className={`${cardClass} xl:col-span-2`}>
                <SectionHeader icon={<Briefcase className="h-6 w-6" weight="bold" aria-hidden="true" />} title="Domain and roles" />
                <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase text-skillpath-teal">Interested domain</h3>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      {domainOptions.map((option) => (
                        <ChoiceButton key={option} label={option} selected={domain === option} disabled={fieldsDisabled} onClick={() => handleDomainChange(option)} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase text-skillpath-teal">Interested roles</h3>
                    <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
                      {currentRoles.map((role) => (
                        <ChoiceButton key={role} label={role} selected={interestedRoles.includes(role)} disabled={fieldsDisabled} onClick={() => toggleRole(role)} />
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className={`${cardClass} xl:col-span-2`}>
                <SectionHeader icon={<Stack className="h-6 w-6" weight="bold" aria-hidden="true" />} title="Existing skills" />
                <div className="p-4 sm:p-5">
                  <div className="mb-3">
                    <ChoiceButton label="None yet" selected={noExistingSkills} disabled={fieldsDisabled} onClick={toggleNoExistingSkills} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                    {currentSkills.map((skill) => (
                      <ChoiceButton key={skill} label={skill} selected={selectedSkills.includes(skill)} disabled={fieldsDisabled || noExistingSkills} onClick={() => toggleSkill(skill)} />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      className={inputClass}
                      value={customSkill}
                      onChange={(event) => setCustomSkill(event.target.value)}
                      placeholder="Add another skill"
                      disabled={fieldsDisabled || noExistingSkills}
                    />
                    <button
                      className="inline-flex h-12 items-center justify-center rounded-md bg-skillpath-teal px-5 text-sm font-black text-skillpath-night transition hover:bg-skillpath-cream disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      onClick={addCustomSkill}
                      disabled={fieldsDisabled || noExistingSkills || customSkill.trim().length === 0}
                    >
                      Add skill
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </section>

          <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
            <section className="rounded-lg border border-skillpath-teal/40 bg-skillpath-cream p-5 text-skillpath-night shadow-panel">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-black">{reviewOpen ? 'Final review' : 'Setup status'}</h2>
                <CheckCircle className="h-7 w-7 text-skillpath-teal" weight={locked ? 'fill' : 'bold'} aria-hidden="true" />
              </div>

              {reviewOpen ? (
                <>
                  <SummaryRows
                    rows={[
                      ['Name', `${firstName} ${lastName}`.trim() || 'Required'],
                      ['Age and gender', `${age}, ${gender}`],
                      ['Email', email || 'Required'],
                      ['Education', isHighSchool ? `${board}, 10th ${tenthPercentage}%, 12th ${twelfthPercentage}%` : `${degree}, ${branch}`],
                      ['College', isHighSchool ? 'High school route' : resolvedCollegeName || 'Required'],
                      ['Study period', isHighSchool ? 'School education' : `${startYear} to ${endYear}`],
                      ['Domain', domain],
                      ['Roles', interestedRoles.length ? interestedRoles.join(', ') : 'Select at least one'],
                      ['Skills', noExistingSkills ? 'None yet' : selectedSkills.length ? selectedSkills.join(', ') : 'Select at least one'],
                      ['Resume', resumeFileName || 'Not uploaded'],
                      ['Transcript', transcriptFileName || 'Not uploaded'],
                      ['Signed in with', lastLoginMethod ?? 'google'],
                    ]}
                  />

                  <div className="mt-5 rounded-lg bg-skillpath-night p-4 text-skillpath-cream">
                    <div className="mb-3 flex items-start gap-2">
                      {locked ? (
                        <SealCheck className="mt-0.5 h-5 w-5 flex-none text-skillpath-teal" weight="fill" aria-hidden="true" />
                      ) : (
                        <PencilSimple className="mt-0.5 h-5 w-5 flex-none text-skillpath-teal" weight="bold" aria-hidden="true" />
                      )}
                      <p className="text-sm font-bold leading-5">
                        {locked ? 'Submitted. Changes are disabled.' : 'Review carefully. Once submitted, these details cannot be changed in this session.'}
                      </p>
                    </div>
                    {!locked ? (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        <button
                          className="inline-flex h-11 items-center justify-center rounded-md border border-white/18 bg-white/8 px-4 text-sm font-black text-skillpath-cream transition hover:border-skillpath-teal"
                          type="button"
                          onClick={editSubmission}
                        >
                          Edit
                        </button>
                        <button
                          className="inline-flex h-11 items-center justify-center rounded-md bg-skillpath-teal px-4 text-sm font-black text-skillpath-night transition hover:bg-skillpath-cream"
                          type="button"
                          onClick={confirmSubmission}
                        >
                          Submit
                        </button>
                      </div>
                    ) : (
                      <button
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-skillpath-teal px-4 text-sm font-black text-skillpath-night transition hover:bg-skillpath-cream"
                        type="button"
                        onClick={continueToGuidelines}
                      >
                        {saving ? 'Saving profile...' : 'Continue to dashboard'}
                        <ArrowRight className="h-4 w-4" weight="bold" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <StatusRow label="Basic details" done={firstName.trim().length > 1 && lastName.trim().length > 1 && email.includes('@')} />
                    <StatusRow label="Education" done={isHighSchool ? Number(tenthPercentage) > 0 && Number(twelfthPercentage) > 0 : resolvedCollegeName.trim().length > 1 && Number(cgpa) > 0 && validStudyDuration} />
                    <StatusRow label="Domain and roles" done={interestedRoles.length > 0} />
                    <StatusRow label="Existing skills" done={noExistingSkills || selectedSkills.length > 0} />
                  </div>
                  {!canSubmit ? (
                    <div className="mt-5 flex gap-2 rounded-md border border-skillpath-danger bg-white p-3 text-sm font-bold text-skillpath-danger">
                      <WarningCircle className="mt-0.5 h-5 w-5 flex-none" weight="bold" aria-hidden="true" />
                      Complete all required fields before review.
                    </div>
                  ) : null}
                  <button
                    className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-night px-4 text-base font-black text-skillpath-cream transition hover:bg-skillpath-forest disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                    type="submit"
                    disabled={!canSubmit}
                  >
                    Review profile
                    <ArrowRight className="h-5 w-5" weight="bold" aria-hidden="true" />
                  </button>
                </>
              )}
            </section>
          </aside>
        </form>
      </div>
    </main>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
      <div className="grid h-10 w-10 place-items-center rounded-md bg-skillpath-teal text-skillpath-night">{icon}</div>
      <h2 className="text-xl font-black text-skillpath-cream">{title}</h2>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={`block ${className}`}>
      <label htmlFor={id} className="mb-2 block text-sm font-black text-skillpath-cream">{label}</label>
      {isValidElement(children) ? cloneElement(children as ReactElement<{ id: string }>, { id }) : children}
    </div>
  );
}

function FileField({ label, fileName, disabled, onChange }: { label: string; fileName: string; disabled: boolean; onChange: (fileName: string) => void }) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  return (
    <label className="block rounded-md border border-white/12 bg-white/8 p-4">
      <span className="mb-3 block text-sm font-black text-skillpath-cream">{label}</span>
      <input
        className="block w-full text-sm font-bold text-skillpath-cream file:mr-3 file:rounded-md file:border-0 file:bg-skillpath-teal file:px-4 file:py-2 file:text-sm file:font-black file:text-skillpath-night"
        type="file"
        accept=".pdf,application/pdf"
        disabled={disabled || uploading}
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          setError(''); onChange('');
          if (!file) return;
          const signature = await file.slice(0, 5).text();
          if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf') || signature !== '%PDF-' || file.size > 5 * 1024 * 1024) {
            setError('Choose a valid PDF file up to 5 MB.'); input.value = ''; return;
          }
          setUploading(true);
          try { const response = await uploadDocument(file, label === 'Resume' ? 'resume' : 'transcript'); onChange(response.filename); }
          catch (err) { setError(err instanceof Error ? err.message : 'Upload failed. Please try again.'); input.value = ''; }
          finally { setUploading(false); }
        }}
      />
      <span className="mt-3 block text-sm font-bold text-skillpath-cream/64">{fileName || 'Optional. PDF only, up to 5 MB.'}</span>
      {error && <span role="alert" className="mt-2 block text-sm text-red-300">{error}</span>}
      {uploading && <span role="status" className="mt-2 block text-sm text-skillpath-cream">Verifying and uploading PDF...</span>}
    </label>
  );
}

function ChoiceButton({ label, selected, disabled, onClick }: { label: string; selected: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      className={`flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        selected ? 'border-skillpath-teal bg-skillpath-teal text-skillpath-night' : 'border-white/12 bg-white/8 text-skillpath-cream hover:border-skillpath-teal'
      }`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      {selected ? <Check className="h-4 w-4 flex-none" weight="bold" aria-hidden="true" /> : null}
    </button>
  );
}

function SummaryRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="space-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md border border-skillpath-line bg-white p-3">
          <p className="font-black text-skillpath-muted">{label}</p>
          <p className="mt-1 font-black text-skillpath-night">{value}</p>
        </div>
      ))}
    </div>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-skillpath-line bg-white p-3 text-sm">
      <span className="font-black text-skillpath-night">{label}</span>
      <span className={done ? 'font-black text-skillpath-focus' : 'font-black text-skillpath-muted'}>{done ? 'Done' : 'Open'}</span>
    </div>
  );
}
