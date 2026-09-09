'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSurveys, createSurvey, submitSurveyResponse } from '@/lib/api';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Heart, TrendingUp, MessageSquare, Award, ThumbsUp, Send, Star, XCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// TODO: Connect to API when available
const SENTIMENT_DATA = [
  { month: 'Aug', positive: 72, neutral: 18, negative: 10 },
  { month: 'Sep', positive: 75, neutral: 16, negative: 9 },
  { month: 'Oct', positive: 73, neutral: 17, negative: 10 },
  { month: 'Nov', positive: 78, neutral: 14, negative: 8 },
  { month: 'Dec', positive: 76, neutral: 15, negative: 9 },
  { month: 'Jan', positive: 80, neutral: 13, negative: 7 },
];

// TODO: Connect to API when available
const RECOGNITION_WALL = [
  { from: 'Sarah Johnson', to: 'Raj Patel', message: 'Outstanding leadership during the HR transformation project!', badge: '🏆 Leadership', date: '2 hours ago' },
  { from: 'Emily Chen', to: 'Michael Brown', message: 'Great job on the new product design launch!', badge: '⭐ Innovation', date: '5 hours ago' },
  { from: 'Raj Patel', to: 'Emily Chen', message: 'Always willing to help team members. True team player!', badge: '🤝 Teamwork', date: '1 day ago' },
  { from: 'Priya Sharma', to: 'Arjun Kumar', message: 'Exceeded quality targets for 3 consecutive months!', badge: '🎯 Excellence', date: '2 days ago' },
];

// TODO: Connect to API when available
const eNPSData = [
  { month: 'Aug', score: 42 },
  { month: 'Sep', score: 45 },
  { month: 'Oct', score: 43 },
  { month: 'Nov', score: 48 },
  { month: 'Dec', score: 50 },
  { month: 'Jan', score: 52 },
];

interface SurveyQuestion {
  id: string;
  question: string;
  type?: string;
  options?: string[];
}

interface Survey {
  id: string;
  title: string;
  description?: string;
  status: string;
  questions?: SurveyQuestion[];
  responses?: number;
  createdAt?: string;
  companyId?: string;
}

export function Engagement() {
  const { currentCompany, user } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
  const [newSurvey, setNewSurvey] = useState({
    title: '',
    description: '',
    questions: [''],
  });

  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});

  // Fetch surveys from API
  const { data: surveysData, isLoading, error } = useQuery({
    queryKey: ['surveys', currentCompany?.id],
    queryFn: () => getSurveys({ companyId: currentCompany?.id }),
    enabled: !!currentCompany?.id,
  });

  const surveys: Survey[] = (surveysData as { data?: Survey[] } | undefined)?.data || [];

  // Map surveys to pulse survey display format
  const pulseSurveys = surveys.map(survey => {
    const firstQuestion = survey.questions?.[0];
    return {
      id: survey.id,
      question: firstQuestion?.question || survey.title,
      title: survey.title,
      status: survey.status,
      responses: survey.responses || 0,
      questions: survey.questions || [],
      score: survey.responses ? Math.min(5, (survey.responses / 10)) : 0,
      trend: survey.status === 'active' ? 'up' : survey.status === 'closed' ? 'stable' : 'down',
    };
  });

  // Calculate engagement metrics from real data
  const totalResponses = pulseSurveys.reduce((sum, s) => sum + s.responses, 0);
  const activeSurveys = pulseSurveys.filter(s => s.status === 'active').length;
  const avgScore = pulseSurveys.length > 0
    ? (pulseSurveys.reduce((sum, s) => sum + s.score, 0) / pulseSurveys.length).toFixed(1)
    : '0';

  // Create survey mutation
  const { mutate: createSurveyMutate, isPending: isCreating } = useMutation({
    mutationFn: createSurvey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      toast({ title: 'Survey launched successfully' });
      setLaunchDialogOpen(false);
      setNewSurvey({ title: '', description: '', questions: [''] });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to launch survey', description: err.message, variant: 'destructive' });
    },
  });

  // Submit survey response mutation
  const { mutate: submitResponse, isPending: isSubmitting } = useMutation({
    mutationFn: submitSurveyResponse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      toast({ title: 'Response submitted' });
      setRespondingTo(null);
      setSurveyAnswers({});
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to submit response', description: err.message, variant: 'destructive' });
    },
  });

  // Handle survey creation
  const handleCreateSurvey = () => {
    if (!newSurvey.title || newSurvey.questions.some(q => !q.trim())) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    createSurveyMutate({
      title: newSurvey.title,
      description: newSurvey.description,
      status: 'active',
      companyId: currentCompany?.id,
      questions: newSurvey.questions.filter(q => q.trim()).map(q => ({
        question: q,
        type: 'rating',
      })),
    });
  };

  // Add a question field
  const addQuestion = () => {
    setNewSurvey(prev => ({ ...prev, questions: [...prev.questions, ''] }));
  };

  // Remove a question field
  const removeQuestion = (index: number) => {
    setNewSurvey(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  // Update a question field
  const updateQuestion = (index: number, value: string) => {
    setNewSurvey(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? value : q),
    }));
  };

  // Handle survey response submission
  const handleSubmitResponse = (surveyId: string, questions: SurveyQuestion[]) => {
    const employeeId = user?.employeeId || user?.id || '';
    for (const q of questions) {
      const answer = surveyAnswers[q.id];
      if (!answer) {
        toast({ title: 'Please answer all questions', variant: 'destructive' });
        return;
      }
      submitResponse({
        questionId: q.id,
        answer,
        employeeId,
      });
    }
  };

  // No company selected
  if (!currentCompany?.id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employee Engagement</h1>
          <p className="text-muted-foreground text-sm">Measure and improve employee satisfaction</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Company Selected</p>
            <p className="text-sm text-muted-foreground mt-1">Please select a company to view engagement data.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employee Engagement</h1>
          <p className="text-muted-foreground text-sm">Measure and improve employee satisfaction</p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setLaunchDialogOpen(true)}
        >
          <Send className="h-4 w-4 mr-2" /> Launch Pulse Survey
        </Button>
      </div>

      {/* Engagement Score */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <Heart className="h-6 w-6 mb-2 opacity-80" />
            {isLoading ? (
              <Skeleton className="h-8 w-12 bg-white/20" />
            ) : (
              <p className="text-3xl font-bold">{avgScore}</p>
            )}
            <p className="text-sm opacity-80">Engagement Score</p>
            <p className="text-xs opacity-70 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> From {pulseSurveys.length} surveys
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">52</p>
            <p className="text-xs text-muted-foreground">eNPS Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MessageSquare className="h-5 w-5 mx-auto text-green-600 mb-1" />
            {isLoading ? (
              <Skeleton className="h-7 w-12 mx-auto" />
            ) : (
              <p className="text-2xl font-bold">{totalResponses > 0 ? `${Math.round((totalResponses / Math.max(activeSurveys, 1)) * 10) / 10}%` : '0%'}</p>
            )}
            <p className="text-xs text-muted-foreground">Survey Participation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ThumbsUp className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">80%</p>
            <p className="text-xs text-muted-foreground">Positive Sentiment</p>
          </CardContent>
        </Card>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load survey data</p>
              <p className="text-xs text-red-600 dark:text-red-400">{error.message}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['surveys'] })}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sentiment Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Employee Sentiment Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={SENTIMENT_DATA}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="positive" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                <Bar dataKey="neutral" stackId="a" fill="#f59e0b" />
                <Bar dataKey="negative" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">eNPS Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={eNPSData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pulse Surveys */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pulse Survey Results</CardTitle>
            <CardDescription>Latest survey responses</CardDescription>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-5 w-14" />
                  </div>
                  <Skeleton className="h-2 w-full mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))
            ) : pulseSurveys.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">No Surveys Yet</p>
                <p className="text-xs text-muted-foreground mt-1">Launch a pulse survey to start collecting feedback.</p>
                <Button
                  className="mt-3 bg-emerald-600 hover:bg-emerald-700"
                  size="sm"
                  onClick={() => setLaunchDialogOpen(true)}
                >
                  <Send className="h-3 w-3 mr-1" /> Launch Survey
                </Button>
              </div>
            ) : (
              pulseSurveys.map(survey => (
                <div key={survey.id} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{survey.question}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] ${
                        survey.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                        survey.status === 'closed' ? 'bg-slate-100 text-slate-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {survey.status}
                      </Badge>
                      {survey.status === 'active' && survey.questions.length > 0 && respondingTo !== survey.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => setRespondingTo(survey.id)}
                        >
                          Respond
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Responding form */}
                  {respondingTo === survey.id && survey.questions.length > 0 ? (
                    <div className="space-y-3 mt-2">
                      {survey.questions.map((q) => (
                        <div key={q.id} className="space-y-1">
                          <p className="text-xs font-medium">{q.question}</p>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <Button
                                key={rating}
                                variant={surveyAnswers[q.id] === String(rating) ? 'default' : 'outline'}
                                size="sm"
                                className={`h-8 w-8 p-0 text-xs ${
                                  surveyAnswers[q.id] === String(rating) ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                                }`}
                                onClick={() => setSurveyAnswers(prev => ({ ...prev, [q.id]: String(rating) }))}
                              >
                                {rating}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          disabled={isSubmitting}
                          onClick={() => handleSubmitResponse(survey.id, survey.questions)}
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setRespondingTo(null); setSurveyAnswers({}); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Progress value={survey.score * 20} className="h-2" />
                        </div>
                        <span className="text-sm font-semibold">{survey.score.toFixed(1)}/5</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{survey.responses} responses</p>
                    </>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recognition Wall */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" /> Recognition Wall
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-3">
            {RECOGNITION_WALL.map((rec, i) => (
              <div key={i} className="p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-[10px]">{rec.badge}</Badge>
                  <span className="text-xs text-muted-foreground">{rec.date}</span>
                </div>
                <p className="text-sm">{rec.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">{rec.from}</span> → <span className="font-medium text-foreground">{rec.to}</span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Launch Pulse Survey Dialog */}
      <Dialog open={launchDialogOpen} onOpenChange={setLaunchDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Launch Pulse Survey</DialogTitle>
            <DialogDescription>Create a new pulse survey to gather employee feedback.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="survey-title">Survey Title *</Label>
              <Input
                id="survey-title"
                placeholder="e.g., Q1 2025 Employee Satisfaction"
                value={newSurvey.title}
                onChange={(e) => setNewSurvey(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-description">Description</Label>
              <Textarea
                id="survey-description"
                placeholder="Brief description of the survey purpose..."
                value={newSurvey.description}
                onChange={(e) => setNewSurvey(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Questions *</Label>
                <Button variant="outline" size="sm" onClick={addQuestion}>
                  + Add Question
                </Button>
              </div>
              {newSurvey.questions.map((q, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Question ${index + 1}`}
                    value={q}
                    onChange={(e) => updateQuestion(index, e.target.value)}
                    className="flex-1"
                  />
                  {newSurvey.questions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-red-600"
                      onClick={() => removeQuestion(index)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaunchDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleCreateSurvey}
              disabled={isCreating}
            >
              {isCreating ? 'Launching...' : 'Launch Survey'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
