import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  History, 
  Settings, 
  Moon, 
  Sun, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  ListChecks, 
  Timer, 
  RotateCcw, 
  Send,
  Link,
  Headphones,
  BookOpen,
  ArrowRight,
  Home as HomeIcon,
  Volume2,
  LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { practices } from './data/questions';
import { PracticeSet, PracticeResult } from './types';
import { cn } from '@/lib/utils';

type View = 'home' | 'module' | 'practice' | 'results' | 'history';

const MODULES = [
  {
    id: '1',
    title: 'Practice 1',
    description: 'Multiple choice questions (A, B, C)',
    longDescription: 'Phần này bao gồm các câu hỏi trắc nghiệm với 3 lựa chọn A, B, C. Bạn sẽ nghe các tình huống ngắn và chọn đáp án đúng nhất.',
    color: 'indigo',
    icon: ListChecks,
    prefix: 'practice_1_'
  },
  {
    id: '2',
    title: 'Practice 2',
    description: 'Matching speakers (A–H)',
    longDescription: 'Phần này yêu cầu bạn nối các ý kiến hoặc thông tin từ danh sách A-H với người nói tương ứng (Speaker 1-5).',
    color: 'emerald',
    icon: Link,
    prefix: 'practice_2_'
  },
  {
    id: '3',
    title: 'Practice 3',
    description: 'Long listening (questions 24–30)',
    longDescription: 'Phần này là một bài nghe dài (thường là phỏng vấn). Bạn sẽ trả lời các câu hỏi từ 24 đến 30 dựa trên nội dung bài nghe.',
    color: 'orange',
    icon: Headphones,
    prefix: 'practice_3_'
  }
];

export default function App() {
  const [view, setView] = useState<View>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [currentPractice, setCurrentPractice] = useState<PracticeSet | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // Practice-specific answers state
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, Record<string, string>>>({});
  
  // Practice-specific results state
  const [practiceResults, setPracticeResults] = useState<Record<string, PracticeResult[]>>({});

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isMemoryBoost, setIsMemoryBoost] = useState(false);
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, string> | null>(null);
  const [shuffleMode, setShuffleMode] = useState(false);

  // Load data from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) setTheme(savedTheme);

    const savedAnswers = localStorage.getItem('practice_answers');
    if (savedAnswers) setPracticeAnswers(JSON.parse(savedAnswers));

    const savedResults = localStorage.getItem('practice_results');
    if (savedResults) setPracticeResults(JSON.parse(savedResults));
    
    const savedLastModule = localStorage.getItem('last_module_id');
    if (savedLastModule) setActiveModuleId(savedLastModule);
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('practice_answers', JSON.stringify(practiceAnswers));
  }, [practiceAnswers]);

  useEffect(() => {
    localStorage.setItem('practice_results', JSON.stringify(practiceResults));
  }, [practiceResults]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive]);

  const activeModule = useMemo(() => 
    MODULES.find(m => m.id === activeModuleId), 
  [activeModuleId]);

  const moduleSubPractices = useMemo(() => {
    if (!activeModule) return [];
    return practices.filter(p => p.id.startsWith(activeModule.prefix));
  }, [activeModule]);

  const userAnswers = useMemo(() => {
    if (reviewAnswers) return reviewAnswers;
    if (!currentPractice) return {};
    return practiceAnswers[currentPractice.id] || {};
  }, [practiceAnswers, currentPractice, reviewAnswers]);

  const results = useMemo(() => {
    if (!currentPractice) return [];
    return practiceResults[currentPractice.id] || [];
  }, [practiceResults, currentPractice]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId: string, answer: string) => {
    if (isReviewMode || isSubmitted || !currentPractice) return;
    setPracticeAnswers(prev => ({
      ...prev,
      [currentPractice.id]: {
        ...prev[currentPractice.id],
        [questionId]: answer
      }
    }));
  };

  const startPractice = (practice: PracticeSet) => {
    // Data integrity check
    practice.questions.forEach(q => {
      if (!q.correct) {
        throw new Error(`Question ${q.id} in ${practice.title} is missing a correct answer.`);
      }
    });

    let questions = [...practice.questions];
    if (shuffleMode) {
      questions = questions.sort(() => Math.random() - 0.5);
    }
    
    setCurrentPractice({ ...practice, questions });
    setCurrentQuestionIndex(0);
    setTimer(0);
    setIsTimerActive(true);
    setIsReviewMode(false);
    setIsSubmitted(false);
    setView('practice');
  };

  const handleSubmit = () => {
    if (!currentPractice) return;
    
    console.log("Clicked submit");
    console.log("User Answers:", userAnswers);
    
    const answeredCount = Object.keys(userAnswers).length;
    const totalQuestions = currentPractice.questions.length;
    const unansweredCount = totalQuestions - answeredCount;

    const performSubmit = () => {
      console.log("Performing submission...");
      setIsTimerActive(false);
      setIsSubmitted(true);
      
      const score = currentPractice.questions.reduce((acc, q) => {
        const isCorrect = userAnswers[q.id] === q.correct;
        return acc + (isCorrect ? 1 : 0);
      }, 0);

      console.log("Calculated Score:", score);

      const newResult: PracticeResult = {
        practiceId: currentPractice.id,
        score,
        total: currentPractice.questions.length,
        answers: { ...userAnswers },
        timestamp: Date.now()
      };

      setPracticeResults(prev => ({
        ...prev,
        [currentPractice.id]: [newResult, ...(prev[currentPractice.id] || [])]
      }));
      
      setShowConfirmModal(false);
    };

    if (unansweredCount > 0) {
      setConfirmModalConfig({
        title: "Chưa hoàn thành",
        message: `Bạn còn ${unansweredCount} câu chưa làm. Bạn đã chắc chắn muốn nộp bài chưa?`,
        onConfirm: performSubmit
      });
      setShowConfirmModal(true);
    } else {
      setConfirmModalConfig({
        title: "Nộp bài",
        message: "Bạn đã chắc chắn muốn nộp bài chưa?",
        onConfirm: performSubmit
      });
      setShowConfirmModal(true);
    }
  };

  const retryPractice = () => {
    if (!currentPractice) return;
    
    setPracticeAnswers(prev => ({
      ...prev,
      [currentPractice.id]: {}
    }));
    
    setCurrentQuestionIndex(0);
    setTimer(0);
    setIsTimerActive(true);
    setIsReviewMode(false);
    setIsSubmitted(false);
    setIsMemoryBoost(false);
    setView('practice');
  };

  const startMemoryBoost = () => {
    if (!currentPractice) return;
    
    const newAnswers = { ...userAnswers };
    currentPractice.questions.forEach(q => {
      if (newAnswers[q.id] !== q.correct) {
        delete newAnswers[q.id];
      }
    });
    
    setPracticeAnswers(prev => ({
      ...prev,
      [currentPractice.id]: newAnswers
    }));
    
    setIsSubmitted(false);
    setIsReviewMode(false);
    setIsMemoryBoost(true);
    setCurrentQuestionIndex(0);
    setView('practice');
  };

  const resetPractice = () => {
    if (!currentPractice) return;
    
    setConfirmModalConfig({
      title: "Xóa bài làm",
      message: "Bạn có chắc chắn muốn xóa toàn bộ câu trả lời của phần này?",
      onConfirm: () => {
        setPracticeAnswers(prev => ({
          ...prev,
          [currentPractice.id]: {}
        }));
        setTimer(0);
        setCurrentQuestionIndex(0);
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  const getModuleProgress = (moduleId: string) => {
    const module = MODULES.find(m => m.id === moduleId);
    if (!module) return 0;
    const subPractices = practices.filter(p => p.id.startsWith(module.prefix));
    const totalQuestions = subPractices.reduce((acc, p) => acc + p.questions.length, 0);
    
    let totalAnswered = 0;
    subPractices.forEach(p => {
      const answers = practiceAnswers[p.id] || {};
      totalAnswered += Object.keys(answers).length;
    });
    
    return Math.min(100, Math.round((totalAnswered / totalQuestions) * 100));
  };

  const currentQuestion = currentPractice?.questions[currentQuestionIndex];
  const isMatchingSet = currentQuestion?.type === 'matching';
  
  const matchingQuestions = useMemo(() => {
    if (!currentPractice || !isMatchingSet) return [];
    return currentPractice.questions.filter(q => q.type === 'matching');
  }, [currentPractice, isMatchingSet]);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const progress = currentPractice 
    ? (Object.keys(userAnswers).filter(id => 
        currentPractice.questions.some(q => q.id === id)
      ).length / currentPractice.questions.length) * 100 
    : 0;

  const getComment = (score: number, total: number) => {
    const ratio = score / total;
    if (ratio < 0.5) return 'Cần cải thiện';
    if (ratio < 0.8) return 'Khá';
    return 'Tốt';
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500 font-sans selection:bg-primary/20",
      theme === 'dark' ? "dark bg-background text-foreground" : "bg-background text-foreground"
    )}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-200/50 dark:border-slate-800/50 h-16 flex items-center px-6">
        <div className="flex items-center justify-between w-full">
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={() => setView('home')}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
              <Headphones className="h-5 w-5" />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
              English<span className="text-primary">Quiz</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex pt-16 min-h-screen">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex flex-col w-[240px] fixed top-16 bottom-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-2">
          <Button
            variant="ghost"
            onClick={() => setView('home')}
            className={cn(
              "w-full h-14 justify-start px-4 rounded-xl font-bold transition-all duration-200",
              view === 'home' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            )}
          >
            <HomeIcon className="mr-3 h-5 w-5" />
            Trang chủ
          </Button>
          
          {MODULES.map((module) => (
            <Button
              key={module.id}
              variant="ghost"
              onClick={() => {
                setActiveModuleId(module.id);
                setView('module');
              }}
              className={cn(
                "w-full h-14 justify-start px-4 rounded-xl font-bold transition-all duration-200",
                activeModuleId === module.id && view === 'module' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              )}
            >
              <module.icon className="mr-3 h-5 w-5" />
              {module.title}
            </Button>
          ))}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 lg:ml-[240px]">
          <div className="max-w-[1501px] mx-auto px-8 py-8 relative z-10">
            <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-6 max-w-2xl mx-auto">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Badge variant="outline" className="rounded-full px-4 py-1 border-primary/20 bg-primary/5 text-primary font-medium mb-4">
                    Hệ thống luyện tập thông minh
                  </Badge>
                </motion.div>
                <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.1] text-blue-950 dark:text-blue-50">
                  Luyện Nghe <span className="text-primary">Tiếng Anh</span>
                </h1>
                <p className="text-blue-800 dark:text-blue-200 text-xl leading-relaxed font-semibold">
                  Chọn một phần luyện tập để bắt đầu nâng cao kỹ năng nghe của bạn ngay hôm nay.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
                {MODULES.map((module, idx) => {
                  const Icon = module.icon;
                  const moduleProgress = getModuleProgress(module.id);
                  
                  return (
                    <motion.div
                      key={module.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ y: -10 }}
                      className="group"
                    >
                      <Card 
                        className={cn(
                          "h-full border-none premium-shadow rounded-[40px] overflow-hidden cursor-pointer transition-all duration-500 bg-white dark:bg-slate-900",
                          module.color === 'indigo' && "hover:ring-4 hover:ring-indigo-500/20",
                          module.color === 'emerald' && "hover:ring-4 hover:ring-emerald-500/20",
                          module.color === 'orange' && "hover:ring-4 hover:ring-orange-500/20"
                        )}
                        onClick={() => {
                          setActiveModuleId(module.id);
                          setView('module');
                          localStorage.setItem('last_module_id', module.id);
                        }}
                      >
                        <div className={cn(
                          "h-32 flex items-center justify-center relative overflow-hidden",
                          module.color === 'indigo' && "bg-indigo-500",
                          module.color === 'emerald' && "bg-emerald-500",
                          module.color === 'orange' && "bg-orange-500"
                        )}>
                          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                          <Icon className="h-16 w-16 text-white relative z-10" />
                        </div>
                        <CardHeader className="p-8">
                          <CardTitle className="text-2xl font-black text-blue-900 dark:text-blue-100 mb-2">{module.title}</CardTitle>
                          <CardDescription className="text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                            {module.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="px-8 pb-8 space-y-6">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                              <span>Tiến độ</span>
                              <span className={cn(
                                module.color === 'indigo' && "text-indigo-500",
                                module.color === 'emerald' && "text-emerald-500",
                                module.color === 'orange' && "text-orange-500"
                              )}>{moduleProgress}%</span>
                            </div>
                            <Progress 
                              value={moduleProgress} 
                              className="h-2 bg-slate-100 dark:bg-slate-800" 
                            />
                          </div>
                          <Button 
                            className={cn(
                              "w-full rounded-2xl h-14 font-bold text-lg shadow-xl transition-all duration-300",
                              module.color === 'indigo' && "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20",
                              module.color === 'emerald' && "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20",
                              module.color === 'orange' && "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
                            )}
                          >
                            Bắt đầu
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {view === 'module' && activeModule && (
            <motion.div
              key="module"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10"
            >
                <div className="space-y-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => setView('home')}
                    className="rounded-full font-bold -ml-4"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Quay lại
                  </Button>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-4 rounded-[24px] text-white",
                      activeModule.color === 'indigo' && "bg-indigo-500",
                      activeModule.color === 'emerald' && "bg-emerald-500",
                      activeModule.color === 'orange' && "bg-orange-500"
                    )}>
                      <activeModule.icon className="h-8 w-8" />
                    </div>
                    <div>
                      <h2 className="text-4xl font-black text-blue-950 dark:text-blue-50">{activeModule.title}</h2>
                      <p className="text-blue-800 dark:text-blue-200 font-bold">{activeModule.description}</p>
                    </div>
                  </div>
                </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 space-y-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 px-2">Chọn bài tập</p>
                  <div className="space-y-2">
                    {moduleSubPractices.map((practice) => {
                      const isActive = currentPractice?.id === practice.id;
                      const isCompleted = Object.keys(userAnswers).some(id => 
                        practice.questions.some(q => q.id === id)
                      );
                      
                      return (
                        <motion.div
                          key={practice.id}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Card 
                            className={cn(
                              "border-none cursor-pointer transition-all duration-200 rounded-xl overflow-hidden h-14",
                              isActive 
                                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                                : "bg-white dark:bg-slate-900 premium-shadow hover:bg-slate-200 dark:hover:bg-slate-800"
                            )}
                            onClick={() => setCurrentPractice(practice)}
                          >
                            <CardContent className="p-0 h-full flex items-center justify-between px-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "h-8 w-8 rounded-lg flex items-center justify-center font-black text-sm",
                                  isActive ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                )}>
                                  {practice.title.split(' ').pop()}
                                </div>
                                <span className={cn(
                                  "font-bold text-sm",
                                  isActive ? "text-white" : "text-slate-700 dark:text-slate-300"
                                )}>{practice.title}</span>
                              </div>
                              {isCompleted && (
                                <CheckCircle2 className={cn("h-5 w-5", isActive ? "text-white" : "text-emerald-500")} />
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-8">
                  <AnimatePresence mode="wait">
                    {currentPractice ? (
                      <motion.div
                        key={currentPractice.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                      >
                        <Card className="border-none bg-white dark:bg-slate-900 premium-shadow rounded-[24px] p-8 space-y-8">
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <Badge className={cn(
                                "rounded-full px-4 py-1 font-black uppercase tracking-widest text-white",
                                activeModule.color === 'indigo' && "bg-indigo-500",
                                activeModule.color === 'emerald' && "bg-emerald-500",
                                activeModule.color === 'orange' && "bg-orange-500"
                              )}>
                                {currentPractice.title}
                              </Badge>
                            </div>
                            
                            <div className="bg-[#EEF2FF] dark:bg-[#1E293B] border-l-4 border-primary p-6 rounded-r-xl space-y-3">
                              <div className="flex items-center gap-2 text-primary font-bold">
                                <BookOpen className="h-5 w-5" />
                                <span>HƯỚNG DẪN</span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                {currentPractice.description}
                              </p>
                            </div>
                          </div>
                          
                          <Button 
                            className={cn(
                              "w-full rounded-[24px] h-16 font-black text-xl shadow-2xl transition-all duration-300 text-white",
                              activeModule.color === 'indigo' && "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/30",
                              activeModule.color === 'emerald' && "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30",
                              activeModule.color === 'orange' && "bg-orange-500 hover:bg-orange-600 shadow-orange-500/30"
                            )}
                            onClick={() => startPractice(currentPractice)}
                          >
                            Bắt đầu luyện tập
                            <Play className="ml-3 h-6 w-6 fill-current" />
                          </Button>
                        </Card>
                      </motion.div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[40px]">
                        <div className="bg-slate-100 dark:bg-slate-800 w-24 h-24 rounded-full flex items-center justify-center">
                          <Play className="h-12 w-12 text-slate-300 ml-1" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-2xl font-black text-blue-900 dark:text-blue-100">Sẵn sàng chưa?</p>
                          <p className="text-blue-800 dark:text-blue-200 font-bold">Chọn một bài tập bên trái để xem chi tiết và bắt đầu.</p>
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'practice' && currentPractice && (
            <motion.div
              key="practice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Practice Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 glass p-4 rounded-[20px] premium-shadow sticky top-20 z-40">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setView('home')}
                    className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white">{currentPractice.title}</h2>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Câu {currentQuestionIndex + 1} / {currentPractice.questions.length}
                      </p>
                      <span className="text-[10px] text-slate-300">•</span>
                      <p className="text-xs font-bold text-primary uppercase tracking-widest">
                        Đã làm: {Object.keys(userAnswers).filter(id => currentPractice.questions.some(q => q.id === id)).length}/{currentPractice.questions.length}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full font-mono font-bold text-primary">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(timer)}</span>
                  </div>
                  {isSubmitted ? (
                    <Button variant="outline" size="sm" onClick={retryPractice} className="rounded-full border-2 font-bold bg-primary text-white hover:bg-primary/90">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Làm lại bài
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={resetPractice} className="rounded-full border-2 font-bold">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    onClick={handleSubmit} 
                    disabled={isSubmitted}
                    className={cn(
                      "rounded-full font-bold px-6 shadow-lg transition-all duration-300",
                      isSubmitted 
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                        : "bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white shadow-indigo-200 dark:shadow-none"
                    )}
                  >
                    {isSubmitted ? 'Đã nộp bài' : 'Nộp bài'}
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Mobile Question Navigator */}
              <div className="lg:hidden overflow-x-auto pb-2 no-scrollbar">
                <div className="flex gap-2">
                  {currentPractice.questions.map((q, idx) => (
                    <Button
                      key={q.id}
                      variant={currentQuestionIndex === idx ? 'default' : userAnswers[q.id] ? 'secondary' : 'outline'}
                      size="sm"
                      className={cn(
                        "h-10 w-10 shrink-0 rounded-xl font-bold transition-all duration-300",
                        currentQuestionIndex === idx && "scale-110 shadow-lg shadow-primary/20",
                        (isReviewMode || isSubmitted) && userAnswers[q.id] === q.correct && "bg-secondary text-white border-secondary",
                        (isReviewMode || isSubmitted) && userAnswers[q.id] && userAnswers[q.id] !== q.correct && "bg-destructive text-white border-destructive"
                      )}
                      onClick={() => setCurrentQuestionIndex(idx)}
                    >
                      {idx + 1}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Question Area */}
                <div className={cn("space-y-6", isMatchingSet ? "lg:col-span-12" : "lg:col-span-8")}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isMatchingSet ? 'matching-set' : currentQuestion?.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      {isMatchingSet ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                          {/* Reference List */}
                          <div className="lg:col-span-5 order-2 lg:order-1" style={{ width: '602px', height: '502.514px' }}>
                            <Card className="border-none bg-white dark:bg-slate-900 premium-shadow rounded-[24px] overflow-hidden sticky top-40">
                              <CardHeader className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                  <ListChecks className="h-4 w-4" />
                                  Danh sách đáp án (A–H)
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-6">
                                <div className="space-y-3">
                                  {Object.entries(matchingQuestions[0].options).map(([key, value]) => {
                                    const isUsed = Object.values(userAnswers).includes(key);
                                    return (
                                      <div 
                                        key={key} 
                                        className={cn(
                                          "flex items-start gap-4 p-4 rounded-xl transition-all duration-300 border-2",
                                          isUsed 
                                            ? "bg-primary/5 border-primary/30 shadow-md ring-1 ring-primary/10" 
                                            : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-100/50 dark:border-slate-800/50"
                                        )}
                                      >
                                        <Badge className={cn(
                                          "h-8 w-8 shrink-0 flex items-center justify-center rounded-lg font-black p-0 transition-all duration-300",
                                          isUsed ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                                        )}>
                                          {key}
                                        </Badge>
                                        <span className={cn(
                                          "text-sm font-bold leading-tight transition-colors duration-300",
                                          isUsed ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
                                        )}>
                                          {value}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="mt-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                                  <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400 leading-relaxed">
                                    Mẹo: Mỗi chữ cái chỉ được sử dụng một lần. Khi bạn chọn một đáp án, nó sẽ được làm nổi bật trong danh sách này.
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Matching Selectors */}
                          <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
                            <Card className="border-none bg-white dark:bg-slate-900 premium-shadow rounded-[24px] overflow-hidden">
                              <div className="p-8 space-y-8">
                                <div className="flex justify-between items-center">
                                  <Badge variant="secondary" className="rounded-full px-4 py-1 font-bold uppercase tracking-widest text-[10px]">
                                    Matching Task
                                  </Badge>
                                  <Button variant="ghost" size="sm" className="rounded-full text-primary font-bold hover:bg-primary/5">
                                    <Volume2 className="h-4 w-4 mr-2" />
                                    Nghe lại
                                  </Button>
                                </div>

                                <div className="space-y-6">
                                  {matchingQuestions.map((q) => {
                                    const answer = userAnswers[q.id] || '';
                                    const isCorrect = (isReviewMode || isSubmitted) && answer === q.correct;
                                    const isWrong = (isReviewMode || isSubmitted) && answer && answer !== q.correct;
                                    const isRedo = isMemoryBoost && !answer;

                                    return (
                                      <div key={q.id} className="space-y-2">
                                        <div className={cn(
                                          "flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 p-5 rounded-2xl border-2 transition-all duration-300",
                                          isCorrect ? "border-secondary bg-secondary/5" : 
                                          isWrong ? "border-destructive bg-destructive/5" :
                                          isRedo ? "border-amber-400 bg-amber-50/50 dark:bg-amber-900/10 shadow-lg shadow-amber-200/20" :
                                          answer ? "border-primary/30 bg-primary/5 shadow-sm" : "border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20"
                                        )}>
                                          <div className="flex flex-col gap-1 min-w-[100px]">
                                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Người nói</span>
                                            <span className="text-lg font-black text-slate-900 dark:text-white">{q.question}</span>
                                          </div>

                                          <div className="relative flex-1">
                                            <select
                                              value={answer}
                                              disabled={isReviewMode || isSubmitted}
                                              onChange={(e) => handleAnswer(q.id, e.target.value)}
                                              className={cn(
                                                "w-full h-14 rounded-xl border-2 bg-white dark:bg-slate-950 px-4 text-sm font-bold transition-all duration-200 focus:ring-4 focus:ring-primary/20 outline-none appearance-none cursor-pointer pr-10",
                                                isCorrect ? "border-secondary text-secondary" :
                                                isWrong ? "border-destructive text-destructive" :
                                                answer ? "border-primary text-primary" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 focus:border-primary"
                                              )}
                                            >
                                              <option value="">Chọn đáp án...</option>
                                              {Object.entries(q.options).map(([key, value]) => {
                                                const isUsedElsewhere = Object.entries(userAnswers).some(([id, val]) => id !== q.id && val === key);
                                                return (
                                                  <option key={key} value={key} disabled={isUsedElsewhere}>
                                                    {key} - {value}
                                                  </option>
                                                );
                                              })}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                              <ChevronRight className="h-5 w-5 rotate-90" />
                                            </div>
                                          </div>

                                          {(isReviewMode || isSubmitted) && (
                                            <div className="flex items-center gap-3 min-w-[140px]">
                                              {isCorrect ? (
                                                <div className="flex items-center gap-2 text-secondary font-bold">
                                                  <CheckCircle2 className="h-5 w-5" />
                                                  <span>Chính xác</span>
                                                </div>
                                              ) : (
                                                <div className="flex flex-col">
                                                  <div className="flex items-center gap-2 text-destructive font-bold">
                                                    <AlertCircle className="h-5 w-5" />
                                                    <span>Sai rồi</span>
                                                  </div>
                                                  <span className="text-xs font-black text-secondary mt-1">Đáp án đúng: {q.correct}</span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="p-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 flex justify-end">
                                <Button 
                                  onClick={handleSubmit}
                                  disabled={isSubmitted}
                                  className={cn(
                                    "rounded-xl h-14 px-12 font-black text-lg transition-all duration-300 shadow-xl",
                                    isSubmitted
                                      ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                      : "bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white shadow-indigo-200 dark:shadow-none"
                                  )}
                                >
                                  <CheckCircle2 className="mr-2 h-5 w-5" />
                                  {isSubmitted ? 'Đã nộp bài' : 'Nộp bài'}
                                </Button>
                              </div>
                            </Card>
                          </div>
                        </div>
                      ) : (
                        <Card className="border-none bg-white dark:bg-slate-900 premium-shadow rounded-[24px] overflow-hidden">
                          <div className="p-8 space-y-8">
                            <div className="flex justify-between items-center">
                              <Badge variant="secondary" className="rounded-full px-4 py-1 font-bold uppercase tracking-widest text-[10px]">
                                {currentQuestion?.type === 'matching' ? 'Matching' : 'Multiple Choice'}
                              </Badge>
                              <Button variant="ghost" size="sm" className="rounded-full text-primary font-bold hover:bg-primary/5">
                                <Volume2 className="h-4 w-4 mr-2" />
                                Nghe lại
                              </Button>
                            </div>
                            
                            <div className="space-y-4">
                              <span className="text-primary font-black text-sm uppercase tracking-[0.2em]">Câu hỏi {currentQuestionIndex + 1}</span>
                              <div className="space-y-3">
                                {(() => {
                                  const text = currentQuestion?.question || '';
                                  const parts = text.split(/(?<=[.?!])\s+/);
                                  if (parts.length > 1) {
                                    return (
                                      <>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg leading-relaxed">
                                          {parts[0]}
                                        </p>
                                        <h3 className="text-[24px] font-bold leading-[1.4] text-slate-900 dark:text-white">
                                          {parts.slice(1).join(' ')}
                                        </h3>
                                      </>
                                    );
                                  }
                                  return (
                                    <h3 className="text-[24px] font-bold leading-[1.4] text-slate-900 dark:text-white">
                                      {text}
                                    </h3>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="grid gap-3">
                            {currentQuestion && Object.entries(currentQuestion.options).map(([key, value]) => {
                              const isSelected = userAnswers[currentQuestion.id] === key;
                              const isCorrect = key === currentQuestion.correct;
                              const isWrong = isSelected && !isCorrect;

                              return (
                                <motion.button
                                  key={key}
                                  disabled={isReviewMode || isSubmitted}
                                  whileHover={!(isReviewMode || isSubmitted) ? { scale: 1.005, y: -2 } : {}}
                                  whileTap={!(isReviewMode || isSubmitted) ? { scale: 0.995 } : {}}
                                  onClick={() => handleAnswer(currentQuestion.id, key)}
                                  className={cn(
                                    "w-full flex items-center gap-5 p-4 rounded-xl border-2 text-left transition-all duration-200 group relative overflow-hidden",
                                    isSelected
                                      ? (isReviewMode || isSubmitted)
                                        ? isCorrect 
                                          ? "border-secondary bg-secondary/10" 
                                          : "border-destructive bg-destructive/10"
                                        : "border-primary bg-primary/5 shadow-md"
                                      : (isReviewMode || isSubmitted) && isCorrect
                                        ? "border-secondary bg-secondary/10"
                                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                                  )}
                                >
                                  <div className={cn(
                                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 font-black text-base transition-all duration-200",
                                    isSelected
                                      ? (isReviewMode || isSubmitted)
                                        ? isCorrect ? "bg-secondary border-secondary text-white" : "bg-destructive border-destructive text-white"
                                        : "bg-primary border-primary text-white shadow-lg shadow-primary/30"
                                      : (isReviewMode || isSubmitted) && isCorrect
                                        ? "bg-secondary border-secondary text-white"
                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 group-hover:border-primary/50 text-slate-500 dark:text-slate-400 group-hover:text-primary"
                                  )}>
                                    {key}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={cn(
                                      "text-base font-medium transition-colors duration-200",
                                      isSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"
                                    )}>{value}</span>
                                    {(isReviewMode || isSubmitted) && isCorrect && (
                                      <span className="text-xs font-bold text-secondary mt-1">Đáp án đúng: {key}</span>
                                    )}
                                  </div>
                                  
                                  {(isReviewMode || isSubmitted) && isCorrect && (
                                    <div className="ml-auto bg-secondary/20 p-2 rounded-full">
                                      <CheckCircle2 className="h-5 w-5 text-secondary" />
                                    </div>
                                  )}
                                  {(isReviewMode || isSubmitted) && isWrong && (
                                    <div className="ml-auto bg-destructive/20 p-2 rounded-full">
                                      <AlertCircle className="h-5 w-5 text-destructive" />
                                    </div>
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex justify-between p-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50">
                          <Button 
                            variant="ghost" 
                            disabled={currentQuestionIndex === 0}
                            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                            className="rounded-xl h-12 px-6 font-bold"
                          >
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Trước đó
                          </Button>
                          
                          {currentQuestionIndex === currentPractice.questions.length - 1 ? (
                            <Button 
                              onClick={handleSubmit}
                              disabled={isSubmitted}
                              className={cn(
                                "rounded-xl h-12 px-10 font-black transition-all duration-300 shadow-lg",
                                isSubmitted
                                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                  : "bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white shadow-indigo-200 dark:shadow-none"
                              )}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              {isSubmitted ? 'Đã nộp bài' : 'Nộp bài'}
                            </Button>
                          ) : (
                            <div className="flex gap-2">
                              <Button 
                                onClick={handleSubmit}
                                disabled={isSubmitted}
                                variant="outline"
                                className={cn(
                                  "rounded-xl h-12 px-4 font-black border-2 lg:hidden transition-all duration-300",
                                  isSubmitted
                                    ? "border-slate-200 text-slate-400 cursor-not-allowed"
                                    : "border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                                )}
                              >
                                {isSubmitted ? 'Đã nộp' : 'Nộp bài'}
                              </Button>
                              <Button 
                                disabled={currentQuestionIndex === currentPractice.questions.length - 1}
                                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                                className="rounded-xl h-12 px-8 font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                              >
                                Tiếp theo
                                <ChevronRight className="ml-2 h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Desktop Sidebar Navigator */}
                <div className="hidden lg:block lg:col-span-4">
                  <div className="sticky top-40 space-y-6">
                    <Card className="border-none bg-white dark:bg-slate-900 premium-shadow rounded-[24px] overflow-hidden">
                      <CardHeader className="p-6 pb-2">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-900 dark:text-blue-100 flex items-center gap-2">
                          <ListChecks className="h-4 w-4" />
                          Tiến độ bài làm
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-5 gap-3">
                          {currentPractice.questions.map((q, idx) => {
                            const isAnswered = !!userAnswers[q.id];
                            const isCorrect = (isReviewMode || isSubmitted) && userAnswers[q.id] === q.correct;
                            const isWrong = (isReviewMode || isSubmitted) && isAnswered && userAnswers[q.id] !== q.correct;

                            return (
                              <motion.button
                                key={q.id}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className={cn(
                                  "h-10 w-10 rounded-xl text-xs font-black transition-all duration-300 border-2",
                                  currentQuestionIndex === idx 
                                    ? "border-primary bg-primary text-white shadow-lg shadow-primary/20" 
                                    : (isReviewMode || isSubmitted)
                                      ? isCorrect
                                        ? "border-secondary bg-secondary text-white"
                                        : isWrong
                                          ? "border-destructive bg-destructive text-white"
                                          : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400"
                                      : isAnswered
                                        ? "border-primary/20 bg-primary/10 text-primary"
                                        : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400"
                                )}
                                onClick={() => setCurrentQuestionIndex(idx)}
                              >
                                {idx + 1}
                              </motion.button>
                            );
                          })}
                        </div>
                        <Separator className="my-6" />
                        <div className="space-y-4">
                          <div className="flex justify-between text-sm font-black">
                            <span className="text-blue-800 dark:text-blue-200">Hoàn thành</span>
                            <span className="text-primary">{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-2 bg-slate-100 dark:bg-slate-800" />
                          
                          <Button 
                            onClick={handleSubmit}
                            disabled={isSubmitted}
                            className={cn(
                              "w-full mt-4 rounded-xl h-14 font-black shadow-xl transition-all duration-300 text-lg",
                              isSubmitted
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                : "bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white shadow-indigo-200 dark:shadow-none"
                            )}
                          >
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                            {isSubmitted ? 'Đã nộp bài' : 'Nộp bài'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {(isReviewMode || isSubmitted) && (
                      <Button 
                        variant="destructive" 
                        className="w-full rounded-2xl h-14 font-bold shadow-xl shadow-destructive/20"
                        onClick={() => { setIsReviewMode(false); setIsSubmitted(false); setReviewAnswers(null); setView(activeModuleId ? 'module' : 'home'); }}
                      >
                        Thoát chế độ xem lại
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Sticky Bottom Bar */}
              {!isSubmitted && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 glass border-t z-50 flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tiến độ</span>
                    <span className="text-sm font-bold text-primary">
                      Đã làm: {Object.keys(userAnswers).filter(id => currentPractice.questions.some(q => q.id === id)).length}/{currentPractice.questions.length}
                    </span>
                  </div>
                  <Button 
                    onClick={handleSubmit}
                    className="rounded-xl h-12 px-8 font-black bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-200"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Nộp bài
                  </Button>
                </div>
              )}

              {/* Inline Results Section */}
              {isSubmitted && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-4xl mx-auto pt-10"
                >
                  <Card className="text-center p-10 border-none bg-white dark:bg-slate-900 premium-shadow rounded-[40px] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-primary to-indigo-400" />
                    <CardHeader className="space-y-6">
                      <motion.div 
                        initial={{ rotate: -20, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", damping: 10, stiffness: 100 }}
                        className="mx-auto bg-primary/10 w-24 h-24 rounded-[30px] flex items-center justify-center mb-2"
                      >
                        <Trophy className="h-12 w-12 text-primary" />
                      </motion.div>
                      <div className="space-y-2">
                        <CardTitle className="text-4xl font-black text-blue-950 dark:text-blue-50">Kết quả bài làm</CardTitle>
                        <CardDescription className="text-lg font-bold text-blue-800 dark:text-blue-200">
                          Bạn đúng {currentPractice.questions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correct ? 1 : 0), 0)}/{currentPractice.questions.length} câu
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-10">
                      <div className="relative inline-flex items-center justify-center">
                        <svg className="w-48 h-48 transform -rotate-90">
                          <circle
                            cx="96"
                            cy="96"
                            r="88"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            className="text-slate-100 dark:text-slate-800"
                          />
                          <motion.circle
                            cx="96"
                            cy="96"
                            r="88"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray={552.92}
                            initial={{ strokeDashoffset: 552.92 }}
                            animate={{ strokeDashoffset: 552.92 - (552.92 * (currentPractice.questions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correct ? 1 : 0), 0) / currentPractice.questions.length)) }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="text-primary"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-5xl font-black text-blue-950 dark:text-blue-50">
                            {Math.round((currentPractice.questions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correct ? 1 : 0), 0) / currentPractice.questions.length) * 100)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <Badge className={cn(
                          "rounded-full px-6 py-2 text-lg font-black shadow-lg",
                          getComment(currentPractice.questions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correct ? 1 : 0), 0), currentPractice.questions.length) === 'Tốt' 
                            ? "bg-secondary text-white shadow-secondary/20" 
                            : getComment(currentPractice.questions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correct ? 1 : 0), 0), currentPractice.questions.length) === 'Khá'
                              ? "bg-yellow-500 text-white shadow-yellow-500/20"
                              : "bg-destructive text-white shadow-destructive/20"
                        )}>
                          {getComment(currentPractice.questions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correct ? 1 : 0), 0), currentPractice.questions.length)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 rounded-[24px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Thời gian</p>
                          <p className="text-2xl font-black text-blue-900 dark:text-blue-100">{formatTime(timer)}</p>
                        </div>
                        <div className="p-6 rounded-[24px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Số câu đúng</p>
                          <p className="text-2xl font-black text-blue-900 dark:text-blue-100">
                            {currentPractice.questions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correct ? 1 : 0), 0)}/{currentPractice.questions.length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row justify-center gap-4 pt-6">
                      <Button onClick={retryPractice} variant="outline" className="rounded-2xl h-14 px-8 border-2 font-bold text-base w-full sm:w-auto">
                        <RotateCcw className="mr-2 h-5 w-5" />
                        Làm lại bài
                      </Button>
                      {currentPractice.questions.some(q => userAnswers[q.id] !== q.correct) && (
                        <Button onClick={startMemoryBoost} className="rounded-2xl h-14 px-8 bg-amber-500 hover:bg-amber-600 text-white font-bold text-base shadow-xl shadow-amber-500/20 w-full sm:w-auto">
                          <Volume2 className="mr-2 h-5 w-5" />
                          Luyện tập lại câu sai (Memory Boost)
                        </Button>
                      )}
                      <Button onClick={() => setView(activeModuleId ? 'module' : 'home')} className="rounded-2xl h-14 px-10 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-base shadow-xl w-full sm:w-auto">
                        <HomeIcon className="mr-2 h-5 w-5" />
                        Về danh sách bài
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'results' && currentPractice && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <Card className="text-center p-10 border-none bg-white dark:bg-slate-900 premium-shadow rounded-[40px] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-primary to-indigo-400" />
                <CardHeader className="space-y-6">
                  <motion.div 
                    initial={{ rotate: -20, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", damping: 10, stiffness: 100 }}
                    className="mx-auto bg-primary/10 w-24 h-24 rounded-[30px] flex items-center justify-center mb-2"
                  >
                    <Trophy className="h-12 w-12 text-primary" />
                  </motion.div>
                  <div className="space-y-2">
                    <CardTitle className="text-4xl font-black text-blue-950 dark:text-blue-50">Hoàn thành!</CardTitle>
                    <CardDescription className="text-lg font-bold text-blue-800 dark:text-blue-200">Bạn đã vượt qua bài tập {currentPractice.title}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-10">
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-48 h-48 transform -rotate-90">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        className="text-slate-100 dark:text-slate-800"
                      />
                      <motion.circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        strokeDasharray={552.92}
                        initial={{ strokeDashoffset: 552.92 }}
                        animate={{ strokeDashoffset: 552.92 - (552.92 * (results[0]?.score / currentPractice.questions.length)) }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="text-primary"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-5xl font-black text-blue-950 dark:text-blue-50">{results[0]?.score}</span>
                      <span className="text-sm font-black text-blue-800 dark:text-blue-300 uppercase tracking-widest">/ {currentPractice.questions.length}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <Badge className={cn(
                      "rounded-full px-6 py-2 text-lg font-black shadow-lg",
                      getComment(results[0]?.score, currentPractice.questions.length) === 'Tốt' ? "bg-secondary text-white shadow-secondary/20" : "bg-primary text-white shadow-primary/20"
                    )}>
                      {getComment(results[0]?.score, currentPractice.questions.length)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 rounded-[24px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Thời gian</p>
                      <p className="text-2xl font-black text-blue-900 dark:text-blue-100">{formatTime(timer)}</p>
                    </div>
                    <div className="p-6 rounded-[24px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Độ chính xác</p>
                      <p className="text-2xl font-black text-blue-900 dark:text-blue-100">{Math.round((results[0]?.score / currentPractice.questions.length) * 100)}%</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row justify-center gap-4 pt-6">
                  <Button onClick={() => setView(activeModuleId ? 'module' : 'home')} variant="outline" className="rounded-2xl h-14 px-8 border-2 font-bold text-base w-full sm:w-auto">
                    <HomeIcon className="mr-2 h-5 w-5" />
                    {activeModuleId ? 'Về danh sách bài' : 'Về trang chủ'}
                  </Button>
                  {currentPractice.questions.some(q => userAnswers[q.id] !== q.correct) && (
                    <Button onClick={startMemoryBoost} className="rounded-2xl h-14 px-8 bg-amber-500 hover:bg-amber-600 text-white font-bold text-base shadow-xl shadow-amber-500/20 w-full sm:w-auto">
                      <Volume2 className="mr-2 h-5 w-5" />
                      Luyện tập lại câu sai
                    </Button>
                  )}
                  <Button onClick={retryPractice} variant="outline" className="rounded-2xl h-14 px-8 border-2 font-bold text-base w-full sm:w-auto">
                    <RotateCcw className="mr-2 h-5 w-5" />
                    Làm lại
                  </Button>
                  <Button onClick={() => { setIsReviewMode(true); setView('practice'); setCurrentQuestionIndex(0); }} className="rounded-2xl h-14 px-10 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-base shadow-xl w-full sm:w-auto">
                    <ListChecks className="mr-2 h-5 w-5" />
                    Xem đáp án chi tiết
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Review Mode Overlay */}
      <AnimatePresence>
        {isReviewMode && view === 'practice' && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[600px] glass premium-shadow p-4 rounded-[24px] z-50 flex items-center justify-between gap-4 border-primary/20"
          >
            <div className="flex items-center gap-3 px-2">
              <div className="bg-primary/10 p-2 rounded-full">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-primary uppercase tracking-widest">Review Mode</p>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Đang xem lại đáp án</p>
              </div>
            </div>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => { setIsReviewMode(false); setReviewAnswers(null); setView(activeModuleId ? 'module' : 'home'); }}
              className="rounded-xl h-12 px-6 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold"
            >
              Thoát
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && confirmModalConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass premium-shadow rounded-[32px] overflow-hidden border-white/20 dark:border-slate-800/50"
            >
              <div className="p-8 space-y-6">
                <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
                  <AlertCircle className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black text-blue-950 dark:text-blue-50">{confirmModalConfig.title}</h3>
                  <p className="text-blue-800/70 dark:text-blue-200/70 font-medium leading-relaxed">
                    {confirmModalConfig.message}
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 rounded-2xl h-14 font-bold text-blue-900 dark:text-blue-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={confirmModalConfig.onConfirm}
                    className="flex-1 rounded-2xl h-14 font-black bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
                  >
                    Xác nhận
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
