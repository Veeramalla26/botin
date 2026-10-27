const SPURIOUS_PHRASES = new Set([
  'thank you',
  'thanks',
  'thank u',
  'thankyou',
  'thank',
  'thank you for joining us',
  'thanks for joining us',
  'thank you for your time',
  'thanks for your time',
  'thank you for listening',
  'thanks for listening',
  'thank you so much',
  'thanks so much',
  'thanks for having me',
  'thank you for having me',
  'nice to meet you',
  'good to meet you',
  'pleasure to meet you',
  'great to meet you',
  'good morning',
  'good afternoon',
  'good evening',
  'welcome',
  'welcome everyone',
  'have a good day',
  'have a nice day',
  'have a great day',
  'take care',
  'see you later',
  'see you soon',
  'looking forward to it',
  'meet google com is sharing a window',
  'sharing meet google com to this tab',
  'sharing this tab to',
  'sharing a window',
  'speech detected',
  'transcribing',
  'ok',
  'okay',
  'k',
  'yeah',
  'yep',
  'yes',
  'no',
  'nope',
  'hmm',
  'hm',
  'um',
  'uh',
  'uh huh',
  'uh-huh',
  'right',
  'sure',
  'got it',
  'mm hmm',
  'mm-hmm',
  'mhm',
  'hello',
  'hi',
  'hey',
  'bye',
  'goodbye',
  'see you',
  'you',
  'great',
  'perfect',
  'cool',
  'nice',
  'alright',
  'all right',
  'sounds good',
  'i see',
  'understood',
  'noted',
  'please',
  'sorry',
  'excuse me',
  'pardon',
  'interview question javascript python react node js sap sql api',
  'interview question javascript python react nodejs sap sql api',
  'job interview question technical terms javascript python react node js sap sql api cloud system design',
  'chatgpt can you hear me',
  'chat gpt can you hear me',
  'chatgpt can you hear me?',
  'can you hear me',
  'can you hear me chatgpt',
  'hello chatgpt',
  'hey chatgpt',
  'hi chatgpt',
  'chatgpt',
  'chat gpt',
  'are you there',
  'are you listening',
  'testing testing',
  'test test',
  'check check',
  'hello hello',
]);

// Greetings and pleasantries; dropped unless a real question follows in the same clip.
const GREETING_PREFIXES = [
  'thank you for',
  'thanks for',
  'thank you so much',
  'thanks so much',
  'good morning',
  'good afternoon',
  'good evening',
  'nice to meet',
  'good to meet',
  'pleasure to meet',
  'great to meet',
  'welcome to',
  'welcome everyone',
  'hello everyone',
  'hi everyone',
  'hey everyone',
  'have a good',
  'have a nice',
  'have a great',
  'looking forward',
  'i appreciate',
  'appreciate your',
  'thanks everyone',
  'thank you everyone',
  'my name is',
  'you re welcome',
  "you're welcome",
];

const SPURIOUS_PREFIXES = [
  'i am a software engineer',
  'i m a software engineer',
  'i m here to talk',
  'i m here to',
  'meet google com is sharing',
  'sharing this tab to',
  'sharing a window',
  'interview question javascript',
  'job interview question',
  'chatgpt',
  'chat gpt',
  'hello chatgpt',
  'hey chatgpt',
  'hi chatgpt',
  'okay chatgpt',
  'can you hear me',
];

const CLOSING_PATTERNS = [
  /^thank you\b/,
  /^thanks\b/,
  /^good (morning|afternoon|evening)\b/,
  /^nice to meet\b/,
  /^good to meet\b/,
  /^pleasure to meet\b/,
  /^great to meet\b/,
  /^welcome\b/,
  /^i appreciate\b/,
  /^appreciate it\b/,
  /^joining us\b/,
  /^for joining\b/,
  /^you re welcome\b/,
  /^you're welcome\b/,
];

const PRESENTATION_PREFIXES = [
  'hello everyone',
  'hi everyone',
  'hey everyone',
  'welcome to this webinar',
  'welcome to the webinar',
  'welcome to today s',
  'in this video',
  'in today s video',
  'today we will',
  'today i will',
  'let s get started',
  'without further ado',
];

export function normalizeTranscript(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasQuestionIntent(text, normalized = normalizeTranscript(text)) {
  return (
    /[?]/.test(text) ||
    /\b(what|why|how|when|where|who|which|can|could|would|should|do|does|did|is|are|was|were|tell|describe|explain|have|has|had|walk|talk|share|give|list|name|define|compare|discuss|introduce|implement|versus|vs|write|program|code|function|algorithm|example|sort|search|walk me through|tell me|talk about|difference between|example of|your experience)\b/i.test(
      normalized
    )
  );
}

function hasExcessiveRepetition(normalized) {
  if (!normalized) return false;

  const sentences = normalized
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);

  const sentenceCounts = new Map();
  for (const sentence of sentences) {
    sentenceCounts.set(sentence, (sentenceCounts.get(sentence) || 0) + 1);
    // Interviewers often repeat a question once; drop only webinar-style loops.
    if (sentenceCounts.get(sentence) >= 3) {
      return true;
    }
  }

  const words = normalized.split(' ');
  if (words.length < 16) return false;

  for (let size = 4; size <= 8; size += 1) {
    const phraseCounts = new Map();
    for (let i = 0; i <= words.length - size; i += 1) {
      const phrase = words.slice(i, i + size).join(' ');
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
      if (phraseCounts.get(phrase) >= 3) {
        return true;
      }
    }
  }

  return false;
}

function isWhisperHintHallucination(normalized) {
  if (!normalized) return false;
  if (normalized.startsWith('interview question javascript')) return true;
  if (normalized.startsWith('job interview question')) return true;
  if (normalized.startsWith('interview question') && /\bjavascript\b/.test(normalized) && /\bpython\b/.test(normalized) && /\breact\b/.test(normalized)) {
    return true;
  }
  if (/\b(chatgpt|chat gpt|openai|gpt-?4)\b/.test(normalized)) return true;
  if (/^(testing|test test|check check|hello hello)\b/.test(normalized)) return true;

  const words = normalized.split(' ').filter(Boolean);
  // Only short audio checks; "Are you ready to relocate to Hyderabad?" is a real question.
  if (words.length <= 6 && /\b(can you hear me|are you (there|listening|working|ready))\b/.test(normalized)) {
    return true;
  }

  const hintTerms = ['javascript', 'python', 'react', 'sap', 'sql', 'api'];
  const hits = hintTerms.filter((term) => normalized.includes(term)).length;
  return hits >= 5 && words.length <= 22;
}

export function isSpuriousTranscript(text) {
  const normalized = normalizeTranscript(text);
  if (!normalized) return true;

  if (isWhisperHintHallucination(normalized)) {
    return true;
  }

  if (SPURIOUS_PHRASES.has(normalized)) {
    return true;
  }

  if (SPURIOUS_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  if (PRESENTATION_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  if (GREETING_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    // "Good morning Pavan, tell me about yourself." still asks something after the greeting.
    return classifyVoicePrompt(text) !== 'question';
  }

  const hasQuestion = hasQuestionIntent(text, normalized);

  if (!hasQuestion && CLOSING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (!hasQuestion && hasExcessiveRepetition(normalized)) {
    return true;
  }

  const wordCount = normalized.split(' ').filter(Boolean).length;

  if (
    !hasQuestion &&
    wordCount <= 8 &&
    /^(thank|thanks|welcome|hello|hi|hey|good|nice|great|pleasure)\b/.test(normalized)
  ) {
    return true;
  }

  return false;
}

const CONTINUATION_PREFIX =
  /^(of|and|or|for|in|on|with|using|like|about|from|to|the|a|an|it|this|that|also|then|now|please|just|same)\b/;

export function looksIncompleteQuestion(text) {
  const normalized = normalizeTranscript(text);
  if (!normalized) return true;
  if (/[?]/.test(text)) return false;
  if (/\b(of|a|an|the|and|or|for|about|asking)$/.test(normalized)) {
    return true;
  }
  const words = normalized.split(' ').filter(Boolean);
  return (
    words.length <= 3 &&
    /^(write|tell|give|example|program|code|explain|i am asking|i m asking|can you|could you|please)\b/.test(
      normalized
    )
  );
}

export function isVoiceContinuation(previous, next) {
  const prev = normalizeTranscript(previous);
  const nextN = normalizeTranscript(next);
  if (!prev || !nextN) return false;
  if (nextN === prev) return true;
  if (prev.includes(nextN) || nextN.includes(prev)) return true;

  const nextWords = nextN.split(' ').filter(Boolean).length;
  if (nextWords > 12) return false;
  if (CONTINUATION_PREFIX.test(nextN) && nextWords <= 10) return true;
  if (looksIncompleteQuestion(previous) && nextWords <= 10) return true;
  if (/\b(it|this|that|same|previous)\b/.test(nextN) && nextWords <= 10) return true;
  return false;
}

export function mergeVoiceTranscripts(previous, next) {
  const prev = (previous || '').trim();
  const nxt = (next || '').trim();
  if (!prev) return nxt;
  if (!nxt) return prev;
  const prevN = normalizeTranscript(prev);
  const nextN = normalizeTranscript(nxt);
  if (prevN.includes(nextN)) return prev;
  if (nextN.includes(prevN)) return nxt;
  return `${prev} ${nxt}`.replace(/\s+/g, ' ');
}

const TECH_TERMS = new Set([
  'python',
  'java',
  'javascript',
  'typescript',
  'react',
  'node',
  'nodejs',
  'sql',
  'sap',
  'html',
  'css',
  'aws',
  'docker',
  'kubernetes',
  'linux',
  'git',
  'api',
  'rest',
  'graphql',
  'mongodb',
  'mysql',
  'postgres',
  'redis',
  'angular',
  'vue',
  'express',
  'django',
  'flask',
  'abap',
  'oops',
  'oop',
  'rbac',
  'palindrome',
  'hashmap',
  'array',
  'kafka',
  'microservices',
  'terraform',
  'jenkins',
  'azure',
  'gcp',
  'firebase',
  'springboot',
  'hibernate',
  'kotlin',
  'golang',
  'nextjs',
  'redux',
  'jwt',
  'oauth',
  'polymorphism',
  'inheritance',
  'encapsulation',
  'abstraction',
  'closures',
  'hoisting',
  'recursion',
  'multithreading',
  'normalization',
  'memoization',
  'hana',
  's4hana',
  'fiori',
]);

// Wider topic vocabulary: a short phrase built on these ("Event loop.", "SQL joins.",
// "Stack and queue.") is an interview prompt even without a question word.
const TOPIC_WORDS = new Set([
  ...TECH_TERMS,
  'c++', 'c#', 'csharp', 'dotnet', 'swift', 'rust', 'scala', 'ruby', 'rails', 'php', 'laravel', 'dart', 'flutter',
  'android', 'ios', 'spring', 'boot', 'jpa', 'servlet', 'servlets', 'jsp', 'nestjs', 'svelte', 'jquery', 'ajax',
  'bootstrap', 'tailwind', 'webpack', 'vite', 'babel', 'jsx', 'dom', 'fastapi', 'pandas', 'numpy', 'tensorflow',
  'pytorch', 'rabbitmq', 'elasticsearch', 'ansible', 'lambda', 's3', 'ec2', 'firestore', 'dynamodb', 'oracle',
  'nosql', 'mongoose', 'prisma', 'cors', 'csrf', 'xss', 'http', 'https', 'tcp', 'udp', 'dns', 'grpc', 'websocket',
  'websockets', 'soap', 'json', 'xml', 'yaml', 'regex', 'github', 'gitlab', 'jira', 'agile', 'scrum', 'kanban',
  'sdlc', 'tdd', 'bdd', 'jest', 'mocha', 'cypress', 'selenium', 'junit', 'pytest', 'postman', 'swagger', 'nginx',
  'tomcat', 'unix', 'bash', 'shell', 'powershell', 'odata', 'cds', 'bapi', 'idoc', 'alv', 'badi', 'bdc', 'sapui5',
  'ui5', 'btp', 'cpi', 'hooks', 'usestate', 'useeffect', 'usememo', 'usecallback', 'props', 'component',
  'components', 'lifecycle', 'closure', 'promise', 'promises', 'async', 'await', 'callback', 'callbacks',
  'prototype', 'currying', 'debounce', 'debouncing', 'throttle', 'throttling', 'interface', 'interfaces',
  'overloading', 'overriding', 'constructor', 'singleton', 'concurrency', 'deadlock', 'mutex', 'semaphore',
  'thread', 'threads', 'algorithm', 'algorithms', 'sorting', 'searching', 'stack', 'queue', 'heap', 'tree',
  'trees', 'graph', 'graphs', 'bfs', 'dfs', 'hashing', 'hashtable', 'arrays', 'string', 'strings', 'pointer',
  'pointers', 'indexing', 'index', 'indexes', 'joins', 'join', 'transaction', 'transactions', 'acid', 'sharding',
  'replication', 'partitioning', 'caching', 'cache', 'microservice', 'monolith', 'serverless', 'container',
  'containers', 'deployment', 'pipeline', 'devops', 'cicd', 'authentication', 'authorization', 'encryption',
  'scalability', 'scaling', 'latency', 'throughput', 'architecture', 'pattern', 'patterns', 'mvc', 'orm', 'dbms',
  'rdbms', 'database', 'databases', 'schema', 'query', 'queries', 'trigger', 'triggers', 'procedure',
  'procedures', 'views', 'cursor', 'cursors', 'complexity', 'fibonacci', 'factorial', 'anagram', 'bubble',
  'binary', 'linked', 'solid', 'ml', 'ai', 'llm', 'llms', 'nlp', 'rag', 'embeddings', 'transformer',
  'transformers', 'collection', 'collections', 'framework', 'frameworks', 'annotation', 'annotations', 'generics',
  'streams', 'lambdas', 'exception', 'exceptions', 'enum', 'enums', 'decorator', 'decorators', 'generators',
  'iterators', 'middleware', 'routing', 'router', 'reducer', 'reducers', 'ssr', 'seo', 'pwa', 'accessibility',
  'flexbox', 'yourself', 'experience', 'background', 'project', 'projects', 'strength', 'strengths',
  'weakness', 'weaknesses', 'challenge', 'challenges', 'achievement', 'achievements', 'hobbies', 'goals',
  'relocation', 'notice', 'ctc', 'salary', 'resume', 'cv', 'design', 'cloud', 'testing', 'debugging',
  'leadership', 'teamwork', 'conflict',
]);

const TOPIC_PHRASES =
  /\b(event loop|virtual dom|linked list|binary (search|tree)|(bubble|merge|quick|insertion|selection|heap) ?sort|hash ?(map|table)|design patterns?|system design|data structures?|big o|rest ?apis?|web ?services?|unit test(ing)?|code review|version control|load balanc(er|ing)|message queues?|dependency injection|garbage collection|memory (leaks?|management)|state management|(error|exception) handling|access modifiers?|abstract class(es)?|spring boot|node\.? ?js|react native|machine learning|deep learning|data science|ci ?cd|notice period)\b|(^|\s)(c\+\+|c#|\.net)(\s|$)/;

// Common English words; real English questions are full of them, transliterated speech is not.
const ENGLISH_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'about', 'as',
  'into', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'does', 'did', 'have', 'has', 'had', 'will',
  'would', 'can', 'could', 'should', 'shall', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'whom', 'whose', 'why', 'how', 'when', 'where', 'there', 'here', 'not', 'no', 'yes', 'so',
  'if', 'then', 'than', 'also', 'just', 'very', 'all', 'any', 'some', 'more', 'most', 'other', 'such', 'only',
  'same', 'too', 'up', 'out', 'over', 'again', 'both', 'each', 'few', 'many', 'much', 'between', 'before', 'after',
  'okay', 'ok', 'please', 'tell', 'explain', 'like', 'know', 'one', 'two', 'get', 'give', 'make', 'use', 'used',
  'work', 'worked', 'want', 'need', 'let', "let's", "it's", "that's", "what's", "i'm", "you're", "we're", "i've",
  "you've", "i'd", "i'll", "don't", "can't", "isn't", "didn't", "doesn't",
]);

function hasTopicTerm(normalized) {
  return (
    normalized.split(' ').some((word) => TOPIC_WORDS.has(word.replace(/[^a-z0-9+#]/g, ''))) ||
    TOPIC_PHRASES.test(normalized)
  );
}

function hasInterviewSignal(text, normalized) {
  if (hasQuestionIntent(text, normalized)) return true;
  return hasTopicTerm(normalized);
}

function looksLikeGibberish(text, normalized) {
  // Acronyms (HTTPS, XHTML) and clusters like "strengths" or "constructor" are real English.
  const acronyms = new Set((text.match(/\b[A-Z]{2,}\b/g) || []).map((word) => word.toLowerCase()));
  const words = normalized
    .split(' ')
    .filter((word) => word.length >= 5 && /^[a-z]+$/.test(word) && !TOPIC_WORDS.has(word) && !acronyms.has(word));
  if (!words.length) return false;
  let bad = 0;
  for (const word of words) {
    if (!/[aeiouy]/.test(word) || /[bcdfghjklmnpqrstvwxz]{6,}/.test(word)) {
      bad += 1;
    }
  }
  return bad > 0 && bad >= Math.ceil(words.length / 2);
}

// Other languages come back in another script, or as Latin words with almost no English
// in them ("Obko kunsi basha main baitkarna pasand hai? Hindi ya English?").
function looksForeign(text, normalized) {
  const letters = text.match(/\p{L}/gu) || [];
  const latin = letters.filter((letter) => /\p{Script=Latin}/u.test(letter)).length;
  if (letters.length && latin / letters.length < 0.7) return true;

  const words = normalized.split(' ').filter(Boolean);
  if (words.length < 6 || hasTopicTerm(normalized)) return false;
  return words.filter((word) => ENGLISH_WORDS.has(word)).length / words.length < 0.15;
}

export function shouldProcessVoiceTranscript(text, { systemListen = false, clarity = 'clear' } = {}) {
  if (clarity === 'garbled') {
    return false;
  }

  // Meet audio the transcriber was unsure of is usually misheard ("most disputed ad on CDC");
  // microphone Listen is the user's own voice, so it keeps those.
  if (systemListen && clarity === 'unclear') {
    return false;
  }

  if (isSpuriousTranscript(text)) {
    return false;
  }

  const normalized = normalizeTranscript(text);
  const wordCount = normalized.split(' ').filter(Boolean).length;

  if (looksLikeGibberish(text, normalized) || looksForeign(text, normalized)) {
    return false;
  }

  if (wordCount === 1) {
    return TECH_TERMS.has(normalized);
  }

  if (
    systemListen &&
    wordCount < 4 &&
    !hasInterviewSignal(text, normalized) &&
    classifyVoicePrompt(text) !== 'question'
  ) {
    return false;
  }

  if (!systemListen && wordCount < 2) {
    return false;
  }

  return true;
}

const PROMPT_FILLERS = [
  'so', 'okay', 'ok', 'alright', 'all right', 'right', 'and', 'but', 'now', 'then', 'well', 'um+', 'uh+', 'uhm',
  'hmm+', 'mm+', 'oh', 'ah', 'basically', 'actually', 'great', 'good', 'nice', 'cool', 'perfect', 'fine', 'yeah',
  'yes', 'yep', 'sure', 'next', 'also', 'anyway', 'anyways', 'finally', 'lastly', 'please', 'hi', 'hello', 'hey',
  'thanks', 'thank you', 'moving on', 'coming to', 'coming back to', 'let me see', "let'?s see", 'got it', 'i see',
  'understood', 'wonderful', 'excellent', 'awesome', 'interesting', 'very good', 'very nice', 'sorry',
  "that'?s (?:good|great|fine|nice|interesting|correct|right|perfect)",
  '(?:(?:my|the|one more|another|last|first|next) )*questions?(?: (?:is|was))?',
];
const LEADING_FILLERS = new RegExp(`^(?:(?:${PROMPT_FILLERS.join('|')})(?:\\s+|$))+`);

// Whole clauses that never need an answer: greetings, back-channel, audio/screen logistics, small talk.
const CHATTER_CLAUSES = [
  /^(good )?(morning|afternoon|evening|day)( to you| everyone| all| guys| sir| ma'?am)?$/,
  /^welcome( back| everyone| to( the| this| our)? (interview|call|meeting|session|round|discussion)( .{0,30})?)?$/,
  /^thank(s| you)( so much| very much| a lot)?( for .{0,40})?$/,
  /^(bye|bye bye|goodbye|see you|see ya|take care|cheers|all the best|best of luck|good luck|have a (good|nice|great|wonderful|lovely) (day|evening|weekend|one))( .{0,20})?$/,
  /^(it was )?(nice|great|good|lovely|a pleasure|pleasure) (to )?(meet|meeting|talk|talking|speak|speaking|chat|chatting|connect|connecting)( (with|to) you)?( too| as well)?$/,
  /^talk to you (later|soon|tomorrow)$/,
  /^(no|nope|correct|exactly|absolutely|definitely|of course|fair enough|no problem|no worries|not a problem|makes sense|that makes sense|sounds good|sounds great|i agree|agreed|true|indeed|i understand|noted|clear|really|seriously|wow|aha|hmm|mhm|uh huh|mm hmm|oh okay|oh ok|oh nice|very good|very nice|good job|well done|nicely done|will do|can do|you know|i know|got you|gotcha|same here|me too)$/,
  /^(that'?s|that is|it'?s|it is|this is)( (a|very|really|quite|pretty|so|too))? (fine|good|great|perfect|correct|right|ok|okay|nice|cool|awesome|interesting|enough|clear|true|wonderful|excellent|fair|helpful|amazing|impressive|good to know|nice to hear|alright|all right|not bad|brilliant|fantastic|lovely|useful)( (answer|point|one|explanation|to know|to hear))?$/,
  /^(that'?s|that is|it'?s|it is) (all|it|about it|enough)( (for|from) (today|now|me|my side|our side|this round|this session))?$/,
  /^(good|great|nice|excellent|perfect|brilliant|fantastic) (answer|explanation|job|work|point|one|stuff)$/,
  /^(is|was|does|did|do|are|were) (it|that|this|you|they)( so| right| true| correct| sure)?$/,
  /^(are you sure|you sure|is that so|is that right|is that correct|isn'?t it|is it not|correct)$/,
  /^(does (that|this|it) make sense|is (that|this|it) clear|any doubts|any doubts so far|clear so far|are you following|you following|with me so far|are you with me)$/,
  /^no (more )?questions( from (my|our) side| from me| for now)?$/,
  /^(can|could|do|did) (you|u) (please )?(hear|see) (me|us|my screen|the screen|my shared screen|my face|my video|it|this|that)( now| properly| clearly| fine| ok| okay| well)?$/,
  /^(am i|are we|is (my|the|your) (voice|audio|sound|mic|microphone|screen|video|camera|internet|network|connection))( clearly| properly| fully)? (audible|visible|clear|loud enough|working|okay|ok|fine|coming through|good|breaking|lagging|frozen)( now| to you| properly| clearly)?$/,
  /^(are you|is it|is that) (able to )?(hear|see|audible|visible)( me| us| my screen| the screen| it)?( now| properly| clearly)?$/,
  /^(i|we) (can|can'?t|cannot|couldn'?t|could not) (hear|see) (you|it|that|your screen|the screen)( now| properly| clearly| well)?$/,
  /^(you are|you'?re|your (voice|audio|mic|microphone|video|screen|internet|network|connection) is) (on mute|muted|not audible|breaking|lagging|frozen|cutting|not clear|unclear|stuck|not visible|low|very low|echoing|breaking up|cutting out)( .{0,20})?$/,
  /^((can|could|would) you |kindly )?(please )?(unmute|mute)( yourself| your mic| your microphone)?( please)?$/,
  /^((can|could|would) you |kindly )?(please )?(turn|switch|put) (on|off) (your|the) (camera|video|mic|microphone)( please)?$/,
  /^((can|could|would) you |kindly )?(please )?(share|present|show)( me| us)? (your|the|my) screen( now| please| once| again)?$/,
  /^((can|could|would) you |kindly )?(please )?stop (sharing|presenting)( your screen| the screen)?( please)?$/,
  /^((can|could|would) you |kindly )?(please )?check (your|the|my) (mic|microphone|audio|video|camera|internet|connection|network|screen|settings)( once| again| please)?$/,
  /^(can|could|would) you (please )?(repeat|say) (that|it|the question|again|once again|the last part|what you said)( again| once again| please)?$/,
  /^(i )?(didn'?t|did not|couldn'?t|could not|can'?t|cannot|don'?t|do not) (get|hear|catch|understand|follow) (you|that|it|what you said|the last part|your question)( properly| clearly)?$/,
  /^(sorry|pardon|pardon me|come again|say again|one more time|excuse me)$/,
  /^(network|internet|connection|audio|video|mic|microphone|camera) (issue|issues|problem|problems)$/,
  /^(my|the|your) (internet|network|connection|wifi|wi-fi) is( a bit| very| really)? (slow|bad|poor|weak|down|unstable|breaking|lagging)$/,
  /^(are|r) (you|u) (there|ready|okay|ok|fine|good|all set|with me|comfortable|audible|joined|in a quiet place)( now| to (start|begin|proceed|go|continue))?$/,
  /^(shall|should|can|could) we (start|begin|proceed|get started|go ahead|move on|continue|wrap up|end|stop)( now| here| the interview| with the interview)?$/,
  /^(let'?s|let us) (start|begin|get started|proceed|go ahead|move on|continue|wrap up|end|stop|see|wait|check)( now| then| here)?$/,
  /^(let'?s|let us) (move|go|jump|switch|proceed|come)( on)?( to| on to| ahead with| with)? (the )?(next|another|other|last|final|coding|technical|hr|managerial|second|third) (question|one|round|topic|section|part|problem)s?$/,
  /^(is )?(this|now|it) (a )?(good|right|ok|okay|fine|convenient) time( to (talk|start|speak|connect))?$/,
  /^(is it|would it be|will it be) (ok|okay|fine|alright|all right)( with you)?( if (we|i) (start|begin|proceed|continue|record|get started)( the interview)?)?$/,
  /^(how are you|how r u|how are you doing|how is it going|how'?s it going|how have you been|how was your (day|weekend|morning)|how is your (day|day going|morning)|how'?s your (day|day going)|what'?s up|how do you do)( today| doing| going)?$/,
  /^how('?s| is| was) (the )?(weather|traffic|climate|your weekend|your day|your morning|everything|life)( there| over there| today| going)?$/,
  /^(did|have) you (had|have|eat|eaten|taken|take) (your )?(lunch|breakfast|dinner|food|tea|coffee)( yet| today)?$/,
  /^(please )?(check|see|look at|open) (the |my |your )?(chat|chat box|chatbox|link|email|mail|document|doc|message|invite|calendar)( once| now| please)?$/,
  /^((do|can|could|will) )?(you|u) (speak|understand|talk in|know) (english|hindi|telugu|tamil|kannada|malayalam|marathi|bengali|gujarati|punjabi|urdu)( language)?( fluently| well)?$/,
  /^where are (you|u) (joining|calling|speaking|connecting|sitting)( from)?( today| now| currently)?$/,
  /^((give|allow) (me|us) |just |wait |hold on |bear with me )*(a |one |few |a few |couple of |a couple of |two |2 )?(sec|secs|second|seconds|minute|minutes|min|mins|moment|moments)( please)?$/,
  /^(hold on|wait|bear with me|one sec|just a sec|just a second|just a minute)( please)?$/,
  /^(please )?(go ahead|go on|carry on|continue|proceed)( please)?$/,
  /^(you can|you may) (go ahead|continue|proceed|start|begin)( now| please)?$/,
  /^(please )?take your (time|own time)( .{0,20})?$/,
];

// The interviewer describing what they are about to do: "Let me share my screen", "I'll paste the question".
const INTERVIEWER_ACTION =
  /^((let me|i will|i'?ll|i am going to|i'?m going to|i am gonna|i'?m gonna|we will|we'?ll|i'?m just going to) (quickly |just |now )?(share|check|see|pull up|open|paste|send|post|drop|type|put|stop sharing|present|look|find|get|note|write down|record|start|end|wrap up|close|admit|add|mute|unmute|refresh|reconnect|rejoin|tell you|explain|walk you through|give you|brief you|describe|introduce|move|go|ask you|take|read|show you)|(i am|i'?m|we are|we'?re) (just )?(sharing|pasting|sending|posting|dropping|typing|adding|opening|checking|looking|pulling up|stopping|presenting|reading|writing|recording|admitting))\b/;
const TASK_FOR_CANDIDATE =
  /\b((can|could|would) you|you (need|have|will have|'?ll have) to|(and|then) (you )?(tell|explain|write|find|solve|implement|design|describe|answer))\b/;

const WH_START = /^(what|what'?s|whats|why|how|how'?s|when|where|which|who|whom|whose)\b/;
const WH_WITH_AUX =
  /^(what|why|how|when|where|which|who|whom|whose)( \S+)? (is|are|was|were|do|does|did|would|will|can|could|should|shall|have|has|had|may|might|must)\b/;
// "What we do here is payments" describes, it does not ask.
const WH_NARRATION = /^(what|how|why|when|where) (we|i|they|he|she)\b/;
const AUX_START =
  /^(can|could|would|will|shall|should|do|does|did|have|has|had|are|is|was|were|may|might|am) (?!(be|been|being|not|also|just|definitely|probably|surely|really|fine|good|great|ok|okay|done|a look)\b)\S/;
const IMPERATIVE_START =
  /^(tell|explain|describe|define|compare|contrast|differentiate|distinguish|elaborate|summari[sz]e|implement|write|code|design|draw|solve|create|build|develop|list|name|mention|discuss|outline|highlight|clarify|justify|calculate|compute|find|reverse|sort|optimi[sz]e|debug|fix|convert|demonstrate|illustrate|introduce|walk|talk|give|share|show|rate|brief|take|help|think|consider|imagine|suppose|assume|say|check|print|count|merge|search|validate|analy[sz]e|evaluate|estimate|recommend|suggest|propose|identify|go through|go over)\b/;
const LETS_PROMPT =
  /^(let'?s|let us) (talk|discuss|chat|start with|begin with|focus on|dive into|look at|switch to|jump to|come to|get into|move to|move on to|go to|go over|go through)\b \S/;
const PROMPT_PHRASES = new RegExp(
  `\\b(${[
    'tell me', 'tell us', 'walk me through', 'walk us through', 'take me through', 'take us through', 'talk about',
    'talk me through', 'difference between', 'differences between', 'differentiate between', 'compared to', 'compare',
    'versus', 'vs', 'pros and cons', 'advantages', 'disadvantages', 'benefits of', 'drawbacks', 'examples? of',
    'example program', 'program to', 'program for', 'code to', 'code for', 'function to', 'function that', 'query to',
    'query for', 'algorithm to', 'algorithm for', 'logic to', 'logic for', 'time complexity', 'space complexity',
    'use cases?', 'real time example', 'real world example', 'your experience', 'your role', 'your responsibilit(y|ies)',
    'your projects?', 'your current', 'your previous', 'your last', 'your recent', 'your strengths?',
    'your weakness(es)?', 'your background', 'your education', 'your qualifications?', 'your skills?', 'your notice',
    'notice period', 'your ctc', 'current ctc', 'expected ctc', 'salary expectations?', 'expected salary',
    'current salary', 'why should we hire', 'about yourself', 'introduce yourself', 'your introduction',
    'self introduction', 'how would you', 'how will you', 'how do you', 'how did you', 'how can you', 'how can we',
    'how to', 'what would you', 'what will you', 'what do you', 'what did you', 'why do you', 'why did you',
    'why would you', 'have you ever', 'have you worked', 'have you used', 'do you know', 'do you have',
    'are you familiar', 'any experience', 'i want to know', "i'?d like to know", 'i would like to know',
    'i wanna know', 'i want to understand', "i'?d like to understand", 'i would like to understand',
    'i want to hear', "i'?d like to hear", 'i would like to hear', 'i want you to', "i'?d like you to",
    'i would like you to', 'i need you to', 'can you', 'could you', 'would you', 'will you', 'i am curious',
    "i'?m curious", 'curious to know', 'curious about', 'interested to know', 'let me know', 'in your resume',
    'on your resume', 'in your cv', 'on your cv', 'your (resume|cv|profile) (says|mentions|shows)',
    '(as per|according to) your (resume|cv|profile)', 'you mentioned', 'you said', 'you have mentioned',
    "you'?ve mentioned", 'you worked on', 'you have worked', "you'?ve worked", 'you used', 'you have used',
    "you'?ve used", "you (need|have|will have|'?ll have) to (write|implement|reverse|find|solve|design|build|create|code|sort|print|check|return|explain|tell|calculate|count|merge|remove|convert|optimi[sz]e|debug|fix)",
  ].join('|')})\\b`
);

// Words that turn a short phrase into a statement ("Our stack is React"), not a topic prompt.
const STATEMENT_WORDS =
  /\b(i|i'?m|i'?ll|i'?ve|i'?d|we|we'?re|we'?ll|we'?ve|they|he|she|it'?s|that'?s|there'?s|is|are|was|were|am|be|been|will|would|should|shall|has|have|had|our|my|us|me|myself|from|here|this|that|thank|thanks|welcome)\b/;
const TOPIC_CONNECTORS = new Set([
  'and', 'or', 'vs', 'versus', 'in', 'of', 'with', 'for', 'on', 'about', 'between', 'the', 'a', 'an', 'your', 'to',
  'using', 'without', 'inside', 'via',
]);
// "Is it?" or "Right?" after a question hands its question mark back to that question.
const QUESTION_TAG =
  /^(right|correct|no|yeah|yes|na|naa|ok|okay|true|is it|isn'?t it|is it not|don'?t you|didn'?t you|aren'?t you|haven'?t you|am i right|isn'?t that so)$/;

function normalizePromptText(text) {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9\s'+#./-]/g, ' ')
    .replace(/\.(?![a-z0-9])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text) {
  return String(text || '')
    .replace(/([.!?]+)(?=\s|$)/g, '$1\n')
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean);
}

function isChatterClause(clause) {
  if (CHATTER_CLAUSES.some((pattern) => pattern.test(clause))) return true;
  const action = clause.match(INTERVIEWER_ACTION);
  return Boolean(action) && !TASK_FOR_CANDIDATE.test(clause.slice(action[0].length));
}

function isPromptClause(clause, { first, asked }) {
  const oneWord = !clause.includes(' ');
  // "Pavan?" or "Sorry?" just calls for attention; "Python?" or "Current company?" asks something.
  if (asked && (!oneWord || hasTopicTerm(clause))) return true;
  if (WH_START.test(clause) && !WH_NARRATION.test(clause) && (first || WH_WITH_AUX.test(clause))) return true;
  return (
    AUX_START.test(clause) ||
    (!oneWord && IMPERATIVE_START.test(clause)) ||
    LETS_PROMPT.test(clause) ||
    PROMPT_PHRASES.test(clause)
  );
}

// A bare topic ("Spring Boot annotations", "Stack and queue") rather than a sentence that
// merely mentions one ("the team uses Jira for tracking").
function isTopicPrompt(sentence) {
  const words = sentence.split(' ').filter(Boolean);
  if (!words.length || words.length > 6 || STATEMENT_WORDS.test(sentence)) return false;
  if (TOPIC_PHRASES.test(sentence)) return true;
  const content = words.filter((word) => !TOPIC_CONNECTORS.has(word));
  const topical = content.filter((word) => TOPIC_WORDS.has(word.replace(/[^a-z0-9+#]/g, ''))).length;
  return topical > 0 && topical * 2 >= content.length;
}

// Decides whether System Listen audio asked the candidate something:
// 'question' (answer it), 'other' (statement or fragment; only useful merged into a question),
// or 'chatter' (greetings, small talk, audio/screen logistics; never answered).
export function classifyVoicePrompt(text) {
  let heardStatement = false;

  for (const sentence of splitSentences(text)) {
    const asked = sentence.endsWith('?');
    const body = sentence.replace(/[.!?]+$/, '');
    const parts = body.split(/[,;:]+|\s[-–—]+\s/);
    // The question mark belongs to the clause it ends, not to a greeting before it.
    let askedIndex = asked ? parts.length - 1 : -1;
    if (askedIndex > 0 && QUESTION_TAG.test(normalizePromptText(parts[askedIndex]))) {
      askedIndex -= 1;
    }
    let first = true;

    for (let i = 0; i < parts.length; i += 1) {
      const raw = normalizePromptText(parts[i]);
      if (!raw || isChatterClause(raw)) continue;
      const clause = raw.replace(LEADING_FILLERS, '').trim();
      if (!clause || isChatterClause(clause)) continue;

      heardStatement = true;
      if (isPromptClause(clause, { first, asked: i === askedIndex })) {
        return 'question';
      }
      first = false;
    }

    const whole = normalizePromptText(body).replace(LEADING_FILLERS, '').trim();
    if (!first && isTopicPrompt(whole)) {
      return 'question';
    }
  }

  return heardStatement ? 'other' : 'chatter';
}
