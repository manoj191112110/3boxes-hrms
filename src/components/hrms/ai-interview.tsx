'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInterviews, createInterview, getCandidates } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Bot, Video, Mic, Type, Code, CheckSquare, Play, Eye,
  Star, Clock, User, Brain, ChevronRight, Loader2,
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

// TODO: Replace with API-driven interview type configuration when endpoint is available
const INTERVIEW_TYPES = [
  { id: 'text', label: 'Text Chat', description: 'AI conducts a text-based interview with smart follow-up questions', icon: <Type className="h-6 w-6" />, color: 'bg-green-50 dark:bg-green-950/30 text-green-600', enabled: true },
  { id: 'voice', label: 'Voice Interview', description: 'AI conducts a voice-based interview with speech analysis', icon: <Mic className="h-6 w-6" />, color: 'bg-teal-50 dark:bg-green-950/30 text-teal-600', enabled: true },
  { id: 'video', label: 'Video Interview', description: 'AI conducts a video interview with facial expression analysis', icon: <Video className="h-6 w-6" />, color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600', enabled: true },
  { id: 'mcq', label: 'MCQ Assessment', description: 'AI generates adaptive multiple-choice questions', icon: <CheckSquare className="h-6 w-6" />, color: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600', enabled: true },
  { id: 'coding', label: 'Coding Challenge', description: 'AI evaluates code submissions with test cases', icon: <Code className="h-6 w-6" />, color: 'bg-teal-50 dark:bg-teal-950/30 text-teal-600', enabled: true },
];

// TODO: Replace with real interview transcript from API when endpoint is available
const TRANSCRIPT_EXCERPT = [
  { role: 'ai', text: 'Hello Alex! I\'m your AI interviewer today for the Senior Full-Stack Developer position. Let\'s start with your experience. Can you tell me about a complex system you\'ve designed recently?' },
  { role: 'candidate', text: 'I recently designed a microservices architecture for an e-commerce platform handling 10K+ requests per second. I used event-driven patterns with Kafka and implemented circuit breakers for resilience.' },
  { role: 'ai', text: 'That sounds impressive! Can you elaborate on how you handled the circuit breaker pattern and what fallback strategies you implemented?' },
  { role: 'candidate', text: 'We used the Hystrix pattern with three fallback levels: cache-first, then degraded service, and finally a graceful error response. This reduced our error rate by 95% during peak loads.' },
  { role: 'ai', text: 'Excellent explanation. Now, let\'s move to a system design question. How would you design a URL shortener service that can handle 100M URLs?' },
];

interface CandidateData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  currentTitle: string | null;
  status: string;
  aiScore: number | null;
  skillMatch: number | null;
  cultureFitScore: number | null;
  jobId: string;
  job?: { id: string; title: string };
}

interface InterviewData {
  id: string;
  type: string;
  scheduledAt: string;
  duration: number | null;
  status: string;
  feedback: string | null;
  rating: number | null;
  meetingLink: string | null;
  aiTranscript: string | null;
  candidateId: string;
  jobId: string;
  candidate?: CandidateData;
}

function getOverallScore(candidate: CandidateData): number {
  const scores = [candidate.aiScore, candidate.skillMatch, candidate.cultureFitScore].filter((s): s is number => s !== null && s !== undefined);
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function AIInterview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentCompany } = useAppStore();

  // Fetch candidates from API
  const {
    data: candidatesResponse,
    isLoading: candidatesLoading,
    error: candidatesError,
  } = useQuery({
    queryKey: ['candidates', 'ai-interview'],
    queryFn: () => getCandidates({ limit: 50 }),
  });

  // Fetch interviews from API
  const {
    data: interviewsResponse,
    isLoading: interviewsLoading,
    error: interviewsError,
  } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => getInterviews({}),
  });

  const candidates: CandidateData[] = (candidatesResponse as { data?: CandidateData[] })?.data || [];
  const interviews: InterviewData[] = (interviewsResponse as { data?: InterviewData[] })?.data || [];

  const [selectedCandidate, setSelectedCandidate] = useState<CandidateData | null>(null);

  // Set default selected candidate when data loads
  React.useEffect(() => {
    if (candidates.length > 0 && !selectedCandidate) {
      setSelectedCandidate(candidates[0]);
    }
  }, [candidates, selectedCandidate]);

  // Schedule Interview dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    candidateId: '',
    jobId: '',
    type: 'technical',
    scheduledAt: '',
    duration: '60',
    meetingLink: '',
  });

  // Create interview mutation
  const createInterviewMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createInterview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      toast({ title: 'Interview Scheduled', description: 'The interview has been scheduled successfully.' });
      setScheduleDialogOpen(false);
      setScheduleForm({ candidateId: '', jobId: '', type: 'technical', scheduledAt: '', duration: '60', meetingLink: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to schedule interview.', variant: 'destructive' });
    },
  });

  const handleScheduleInterview = () => {
    if (!scheduleForm.candidateId || !scheduleForm.jobId || !scheduleForm.scheduledAt) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    createInterviewMutation.mutate({
      candidateId: scheduleForm.candidateId,
      jobId: scheduleForm.jobId,
      type: scheduleForm.type,
      scheduledAt: scheduleForm.scheduledAt,
      duration: parseInt(scheduleForm.duration, 10),
      meetingLink: scheduleForm.meetingLink || undefined,
    });
  };

  // Derive radar data from selected candidate's AI scores
  const radarData = selectedCandidate
    ? [
        { subject: 'AI Score', A: selectedCandidate.aiScore ?? 0 },
        { subject: 'Skill Match', A: selectedCandidate.skillMatch ?? 0 },
        { subject: 'Culture Fit', A: selectedCandidate.cultureFitScore ?? 0 },
      ]
    : [];

  const overallScore = selectedCandidate ? getOverallScore(selectedCandidate) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Interview</h1>
          <p className="text-muted-foreground text-sm">Conduct AI-powered interviews with smart evaluation</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setScheduleDialogOpen(true)}>
          <Play className="h-4 w-4 mr-2" /> Schedule Interview
        </Button>
      </div>

      {/* Schedule Interview Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>Create a new interview session for a candidate.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Candidate *</Label>
              <Select
                value={scheduleForm.candidateId}
                onValueChange={(value) => {
                  const cand = candidates.find((c) => c.id === value);
                  setScheduleForm((prev) => ({
                    ...prev,
                    candidateId: value,
                    jobId: cand?.jobId || prev.jobId,
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.filter((c) => c.id && c.id.trim()).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Job ID *</Label>
              <Input
                value={scheduleForm.jobId}
                onChange={(e) => setScheduleForm((prev) => ({ ...prev, jobId: e.target.value }))}
                placeholder="Job ID (auto-filled from candidate)"
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label>Interview Type</Label>
              <Select
                value={scheduleForm.type}
                onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="coding">Coding</SelectItem>
                  <SelectItem value="mcq">MCQ Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scheduled Date & Time *</Label>
              <Input
                type="datetime-local"
                value={scheduleForm.scheduledAt}
                onChange={(e) => setScheduleForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={scheduleForm.duration}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, duration: e.target.value }))}
                  placeholder="60"
                />
              </div>
              <div className="space-y-2">
                <Label>Meeting Link</Label>
                <Input
                  value={scheduleForm.meetingLink}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, meetingLink: e.target.value }))}
                  placeholder="https://meet.example.com/..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleScheduleInterview}
              disabled={createInterviewMutation.isPending}
            >
              {createInterviewMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scheduling...</>
              ) : (
                <><Play className="h-4 w-4 mr-2" /> Schedule</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="types" className="space-y-4">
        <TabsList>
          <TabsTrigger value="types">Interview Types</TabsTrigger>
          <TabsTrigger value="scores">Score Cards</TabsTrigger>
          <TabsTrigger value="transcript">Transcript View</TabsTrigger>
        </TabsList>

        <TabsContent value="types">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTERVIEW_TYPES.map(type => (
              <Card key={type.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${type.color}`}>
                    {type.icon}
                  </div>
                  <h3 className="font-semibold mb-1">{type.label}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{type.description}</p>
                  <div className="flex items-center gap-2">
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" size="sm">
                      <Play className="h-3.5 w-3.5 mr-1" /> Configure
                    </Button>
                    <Button variant="outline" size="sm">
                      <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Interviews List */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" /> Recent Interviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              {interviewsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : interviewsError ? (
                <p className="text-sm text-muted-foreground">Failed to load interviews.</p>
              ) : interviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No interviews scheduled yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {interviews.slice(0, 10).map((interview) => (
                    <div key={interview.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                          <User className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{interview.candidate ? `${interview.candidate.firstName} ${interview.candidate.lastName}` : 'Unknown Candidate'}</p>
                          <p className="text-xs text-muted-foreground">
                            {interview.type} · {interview.duration || 60} min · {new Date(interview.scheduledAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={`text-[10px] ${
                        interview.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        interview.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                        interview.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {interview.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores" className="space-y-4">
          {candidatesLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Candidates</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-5 w-12 rounded-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Evaluation Radar</CardTitle></CardHeader>
                <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Score Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : candidatesError ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Failed to load candidate scores. Please try again later.</p>
              </CardContent>
            </Card>
          ) : candidates.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No candidates found. Add candidates to see AI evaluation scores.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Candidate List */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Candidates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {candidates.map(candidate => {
                    const score = getOverallScore(candidate);
                    return (
                      <div
                        key={candidate.id}
                        onClick={() => setSelectedCandidate(candidate)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedCandidate?.id === candidate.id ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border hover:bg-accent/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{candidate.firstName} {candidate.lastName}</p>
                            <p className="text-xs text-muted-foreground">{candidate.currentTitle || 'No title'}</p>
                          </div>
                          <Badge className={`text-[10px] ${
                            score >= 85 ? 'bg-emerald-100 text-emerald-800' :
                            score >= 75 ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            <Brain className="h-3 w-3 mr-1" />{score}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Radar Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Evaluation Radar</CardTitle>
                  <CardDescription>
                    {selectedCandidate ? `${selectedCandidate.firstName} ${selectedCandidate.lastName}` : 'No candidate selected'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedCandidate ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis domain={[0, 100]} />
                        <Radar name="Score" dataKey="A" stroke="#059669" fill="#059669" fillOpacity={0.2} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Select a candidate to view scores</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Score Breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Score Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedCandidate ? (
                    <>
                      {[
                        { label: 'AI Score', value: selectedCandidate.aiScore ?? 0 },
                        { label: 'Skill Match', value: selectedCandidate.skillMatch ?? 0 },
                        { label: 'Culture Fit', value: selectedCandidate.cultureFitScore ?? 0 },
                      ].map(skill => (
                        <div key={skill.label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>{skill.label}</span>
                            <span className="font-medium">{skill.value}%</span>
                          </div>
                          <Progress value={skill.value} className="h-2" />
                        </div>
                      ))}
                      <div className="pt-3 border-t mt-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">Overall Score</span>
                          <Badge className={`text-sm px-3 py-1 ${
                            overallScore >= 85 ? 'bg-emerald-100 text-emerald-800' :
                            overallScore >= 75 ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            <Star className="h-3.5 w-3.5 mr-1" />{overallScore}/100
                          </Badge>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">Select a candidate to view breakdown</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transcript">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-emerald-600" /> Interview Transcript
              </CardTitle>
              {/* TODO: Replace static transcript with real aiTranscript from Interview API data */}
              <CardDescription>Senior Full-Stack Developer · Text Interview · 25 min</CardDescription>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto space-y-3">
              {TRANSCRIPT_EXCERPT.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                    msg.role === 'ai'
                      ? 'bg-muted rounded-tl-none'
                      : 'bg-emerald-600 text-white rounded-tr-none'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {msg.role === 'ai' ? (
                        <><Bot className="h-3.5 w-3.5" /><span className="text-[10px] font-medium">AI Interviewer</span></>
                      ) : (
                        <><User className="h-3.5 w-3.5" /><span className="text-[10px] font-medium">Candidate</span></>
                      )}
                    </div>
                    <p>{msg.text}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
