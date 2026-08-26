import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Star, MessageSquare, AlertTriangle, Loader2, X, Plus,
  TrendingUp, TrendingDown, ThumbsUp, ThumbsDown, Send,
  CheckCircle2, Clock, Search, Download, Brain
} from 'lucide-react';

type SurveyQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  choices: string[] | null;
  display_order: number;
  is_active: boolean;
};

type SurveyResponse = {
  id: string;
  order_id: string | null;
  customer_phone: string | null;
  overall_rating: number | null;
  responses: Record<string, any>;
  feedback_text: string | null;
  submitted_at: string;
  is_verified: boolean;
};

type SurveyLink = {
  id: string;
  order_id: string | null;
  customer_phone: string | null;
  token: string;
  expires_at: string;
  used_at: string | null;
};

export function SurveyPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'questions' | 'responses' | 'links'>('dashboard');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [links, setLinks] = useState<SurveyLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: qs }, { data: rs }, { data: ls }] = await Promise.all([
      supabase.from('survey_questions').select('*').order('display_order'),
      supabase.from('survey_responses').select('*').order('submitted_at', { ascending: false }).limit(100),
      supabase.from('survey_links').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setQuestions((qs as SurveyQuestion[]) || []);
    setResponses((rs as SurveyResponse[]) || []);
    setLinks((ls as SurveyLink[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const avgRating = responses.length > 0
    ? (responses.filter(r => r.overall_rating).reduce((s, r) => s + (r.overall_rating || 0), 0) / responses.filter(r => r.overall_rating).length).toFixed(1)
    : '—';
  const totalResponses = responses.length;
  const satisfiedCount = responses.filter(r => (r.overall_rating || 0) >= 4).length;
  const dissatisfiedCount = responses.filter(r => (r.overall_rating || 0) <= 2).length;
  const satisfactionRate = totalResponses > 0 ? Math.round((satisfiedCount / totalResponses) * 100) : 0;
  const recentLowRatings = responses.filter(r => (r.overall_rating || 0) <= 2).slice(0, 5);

  const generateLink = async (phone: string) => {
    const token = crypto.randomUUID().replace(/-/g, '');
    const { error } = await supabase.from('survey_links').insert({
      customer_phone: phone || null,
      token,
    });
    if (error) { alert('خطا: ' + error.message); return; }
    const link = `${window.location.origin}/survey/${token}`;
    navigator.clipboard.writeText(link);
    alert('لینک نظرسنجی کپی شد:\n' + link);
    fetchAll();
  };

  const exportResponses = () => {
    const headers = ['امتیاز', 'تلفن', 'توضیحات', 'تاریخ', 'تایید شده'];
    const rows = responses.map(r => [
      r.overall_rating || '',
      r.customer_phone || '',
      (r.feedback_text || '').replace(/,/g, '؛'),
      new Date(r.submitted_at).toLocaleDateString('fa-IR'),
      r.is_verified ? 'بله' : 'خیر',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'survey-responses.csv';
    a.click();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>;
  }

  const tabs = [
    { key: 'dashboard', label: 'داشبورد نظرسنجی', icon: Star },
    { key: 'questions', label: 'سوالات', icon: MessageSquare },
    { key: 'responses', label: 'پاسخ‌ها', icon: ThumbsUp },
    { key: 'links', label: 'لینک‌ها', icon: Send },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Icon className="w-4 h-4" /><span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Star} label="میانگین امتیاز" value={avgRating + ' / ۵'} color="#f59e0b" bg="bg-amber-50" />
            <StatCard icon={MessageSquare} label="کل پاسخ‌ها" value={totalResponses.toLocaleString('fa-IR')} color="#3b82f6" bg="bg-blue-50" />
            <StatCard icon={ThumbsUp} label="نرخ رضایت" value={satisfactionRate + '٪'} color="#10b981" bg="bg-emerald-50" />
            <StatCard icon={ThumbsDown} label="ناراضی" value={dissatisfiedCount.toLocaleString('fa-IR')} color="#ef4444" bg="bg-red-50" />
          </div>

          {/* Real-time Low Rating Alerts */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-bold text-gray-800 text-sm">هشدار نارضایتی مشتریان</h3>
            </div>
            {recentLowRatings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">هیچ هشدار نارضایتی وجود ندارد</p>
            ) : (
              <div className="space-y-2">
                {recentLowRatings.map(r => (
                  <div key={r.id} className="flex items-center gap-3 bg-red-50/50 rounded-xl px-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                      <Star className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">امتیاز: {r.overall_rating} از ۵</p>
                      {r.feedback_text && <p className="text-xs text-gray-500 line-clamp-1">{r.feedback_text}</p>}
                      <p className="text-xs text-gray-400">{new Date(r.submitted_at).toLocaleDateString('fa-IR')} {new Date(r.submitted_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {r.customer_phone && <span className="text-xs text-gray-400" dir="ltr">{r.customer_phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rating Distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-gray-800 text-sm">توزیع امتیازها</h3>
            </div>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map(rating => {
                const count = responses.filter(r => r.overall_rating === rating).length;
                const percent = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-16">
                      <span className="text-sm font-medium text-gray-600">{rating}</span>
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-orange-500 transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="text-sm text-gray-500 w-12 text-left">{count.toLocaleString('fa-IR')}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-gradient-to-l from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-gray-800 text-sm">تحلیل هوش مصنوعی نظرسنجی‌ها</h3>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• {satisfactionRate >= 70 ? 'رضایت مشتریان در سطح مطلوب است. ادامه دهید.' : satisfactionRate >= 50 ? 'رضایت مشتریان متوسط است. نیاز به بهبود وجود دارد.' : 'رضایت مشتریان پایین است. اقدام فوری لازم است.'}</p>
              <p>• {dissatisfiedCount > 0 ? `${dissatisfiedCount} پاسخ ناراضی دریافت شده — بررسی بازخوردها توصیه می‌شود.` : 'هیچ پاسخ ناراضی ثبت نشده است.'}</p>
              <p>• {totalResponses < 10 ? 'تعداد پاسخ‌ها کم است. ارسال لینک نظرسنجی به مشتریان توصیه می‌شود.' : 'حجم پاسخ‌ها کافی برای تحلیل معنادار است.'}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">مدیریت سوالات نظرسنجی</p>
            <button onClick={() => { setEditingQuestion(null); setShowQuestionModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-100 whitespace-nowrap">
              <Plus className="w-4 h-4" /><span>سوال جدید</span>
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-sm text-gray-400">سوالی ثبت نشده است</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-gray-400 text-xs">
                    <th className="text-right font-medium px-4 py-3">ترتیب</th>
                    <th className="text-right font-medium px-4 py-3">سوال</th>
                    <th className="text-right font-medium px-4 py-3">نوع</th>
                    <th className="text-right font-medium px-4 py-3">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map(q => (
                    <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => { setEditingQuestion(q); setShowQuestionModal(true); }}>
                      <td className="px-4 py-3 text-gray-400">{q.display_order}</td>
                      <td className="px-4 py-3 text-gray-700">{q.question_text}</td>
                      <td className="px-4 py-3 text-gray-500">{questionTypeLabels[q.question_type] || q.question_type}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${q.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                          {q.is_active ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'responses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{responses.length} پاسخ دریافت شده</p>
            <button onClick={exportResponses}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
              <Download className="w-4 h-4" /><span>خروجی CSV</span>
            </button>
          </div>
          {responses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
              <ThumbsUp className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">پاسخی ثبت نشده است</p>
            </div>
          ) : (
            <div className="space-y-2">
              {responses.map(r => (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} className={`w-4 h-4 ${i <= (r.overall_rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                        ))}
                      </div>
                      {r.is_verified && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(r.submitted_at).toLocaleDateString('fa-IR')}</span>
                  </div>
                  {r.feedback_text && <p className="text-sm text-gray-600 mt-2">{r.feedback_text}</p>}
                  {r.customer_phone && <p className="text-xs text-gray-400 mt-1" dir="ltr">{r.customer_phone}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'links' && (
        <div className="space-y-4">
          <GenerateLinkForm onGenerate={generateLink} />
          {links.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
              <Send className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">لینکی تولید نشده است</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-gray-400 text-xs">
                    <th className="text-right font-medium px-4 py-3">تلفن</th>
                    <th className="text-right font-medium px-4 py-3">توکن</th>
                    <th className="text-right font-medium px-4 py-3">انقضا</th>
                    <th className="text-right font-medium px-4 py-3">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map(l => (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-600" dir="ltr">{l.customer_phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs" dir="ltr">{l.token.substring(0, 16)}...</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(l.expires_at).toLocaleDateString('fa-IR')}</td>
                      <td className="px-4 py-3">
                        {l.used_at ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-50 text-gray-500">استفاده شده</span>
                        ) : new Date(l.expires_at) > new Date() ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">فعال</span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600">منقضی</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showQuestionModal && (
        <QuestionModal question={editingQuestion} onClose={() => setShowQuestionModal(false)} onSaved={() => { setShowQuestionModal(false); fetchAll(); }} />
      )}
    </div>
  );
}

const questionTypeLabels: Record<string, string> = {
  rating: 'امتیازدهی', text: 'متن آزاد', choice: 'چند گزینه‌ای', yes_no: 'بله/خیر',
};

function StatCard({ icon: Icon, label, value, color, bg }: { icon: typeof Star; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-lg font-bold text-gray-800" dir="ltr">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function GenerateLinkForm({ onGenerate }: { onGenerate: (phone: string) => void }) {
  const [phone, setPhone] = useState('');
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Send className="w-5 h-5 text-amber-500" />
        <h3 className="font-bold text-gray-800 text-sm">تولید لینک نظرسنجی</h3>
      </div>
      <div className="flex items-center gap-3">
        <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
          dir="ltr" className="modal-input flex-1" placeholder="09xxxxxxxxx" />
        <button onClick={() => onGenerate(phone)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold whitespace-nowrap">
          <Send className="w-4 h-4" /><span>تولید و کپی</span>
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">لینک نظرسنجی تولید شده و در کلیپ‌بورد کپی می‌شود. می‌توانید آن را برای مشتری پیامک کنید.</p>
    </div>
  );
}

function QuestionModal({ question, onClose, onSaved }: {
  question: SurveyQuestion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    question_text: question?.question_text || '',
    question_type: question?.question_type || 'rating',
    display_order: question?.display_order || 1,
    is_active: question?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let result;
    if (question) {
      result = await supabase.from('survey_questions').update(form).eq('id', question.id);
    } else {
      result = await supabase.from('survey_questions').insert(form);
    }
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="font-bold text-gray-800">{question ? 'ویرایش سوال' : 'سوال جدید'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertTriangle className="w-4 h-4" /><span>{error}</span></div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">متن سوال <span className="text-red-400">*</span></label>
            <input type="text" value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })} required className="modal-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع سوال</label>
              <select value={form.question_type} onChange={e => setForm({ ...form, question_type: e.target.value })} className="modal-input">
                {Object.entries(questionTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ترتیب نمایش</label>
              <input type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: Number(e.target.value) })} min="1" dir="ltr" className="modal-input" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded accent-amber-500" />
            <span className="text-sm text-gray-600">فعال</span>
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}<span>ذخیره</span>
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">انصراف</button>
          </div>
        </form>
      </div>
    </div>
  );
}
