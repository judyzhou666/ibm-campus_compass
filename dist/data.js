export const DAYS=['Mon','Tue','Wed','Thu','Fri'];
export const DATES=['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'];
export const TOPICS=['AI & education','Career','Social','Arts & culture','Wellbeing'];
export const DEFAULT_BLOCKS=[
{id:'c1',title:'Learning Sciences',day:0,start:600,end:720},
{id:'c2',title:'Research Methods',day:1,start:600,end:720},
{id:'c3',title:'Project studio',day:2,start:780,end:960},
{id:'c4',title:'Learning Sciences',day:3,start:600,end:720},
{id:'c5',title:'Independent study',day:4,start:540,end:660}];
const records=[
['Learning with AI: a hands-on lab','Academic',1,900,990,'Learning Studio','AI & education','Coffee & snacks',0,'open','Build a small learning tool and discuss where human judgment matters.','LEARN / MAKE'],
['Conversations beyond your major','Social',3,1020,1110,'Campus Commons','Social','Free meal',0,'open','A welcoming shared table for students across schools and cultures.','MEET / SHARE'],
['Your first role in responsible tech','Career',4,780,840,'Career Studio','Career','None',0,'open','A practical conversation about early-career paths in technology.','IDEAS / FUTURES'],
['Education research roundtable','Academic',1,630,720,'Seminar Room 2','AI & education','Coffee & snacks',0,'open','Discuss research questions in education and artificial intelligence.','ASK / DISCOVER'],
['AI in the classroom: open studio','Workshops',3,900,990,'Learning Studio','AI & education','None',0,'open','Explore teaching prototypes and exchange constructive feedback.','BUILD / LEARN'],
['Community dinner & story exchange','Social',1,1080,1170,'Campus Commons','Social','Free meal',0,'open','Share a meal and stories about finding your way on a new campus.','FOOD / FRIENDS'],
['Designing your career story','Career',1,780,840,'Career Studio','Career','None',0,'open','Practice introducing your interests in a small peer workshop.','NEXT / CHAPTER'],
['Autumn sketchbook walk','Social',4,960,1050,'Garden Meeting Point','Arts & culture','Unknown',0,'open','Slow down, sketch outdoors and meet creative students.','LOOK / CREATE'],
['Graduate makers night','Workshops',2,1050,1170,'Maker Space','AI & education','Paid food',8,'open','Prototype an idea with a mixed-discipline student team.','THINK / MAKE'],
['Mindful movement on the lawn','Wellbeing',0,750,795,'South Lawn','Wellbeing','None',0,'open','A gentle outdoor movement break, with no experience needed.','PAUSE / RESET'],
['International tea table','Social',3,780,840,'Campus Commons','Social','Coffee & snacks',0,'open','Meet students from different backgrounds over tea.','TEA / TALK'],
['Data science members lab','Academic',4,900,990,'Data Studio','AI & education','None',0,'members','A members-only session; demo student membership is not verified.','DATA / IDEAS'],
['Film club evening','Social',4,1080,1200,'Screening Room','Arts & culture','Paid food',5,'open','Watch a short-film selection and join the discussion.','WATCH / TALK'],
['Student research lightning talks','Academic',0,960,1050,'Learning Studio','AI & education','Coffee & snacks',0,'open','Five short talks on learning, technology and research.','FRESH / IDEAS'],
['Coffee with alumni','Career',3,840,885,'Career Studio','Career','Coffee & snacks',0,'unknown','An informal career chat. Audience eligibility still needs confirmation.','COFFEE / PATHS'],
['Friday community lunch','Social',4,720,780,'Campus Commons','Social','Free meal',0,'open','An easy place to meet someone new between classes.','LUNCH / TOGETHER'],
['Student wellbeing circle','Wellbeing',1,960,1020,'Wellbeing Room','Wellbeing','None',0,'open','Share practical routines for a balanced graduate-student week.','SPACE / BREATHE'],
['Creative coding introduction','Workshops',0,840,930,'Maker Space','AI & education','None',0,'open','Experiment with simple visual code; beginners are welcome.','CODE / PLAY'],
['Museum conversations','Social',2,990,1050,'Gallery Foyer','Arts & culture','None',0,'open','Discuss art and cultural perspectives with a small student group.','ART / PERSPECTIVE'],
['Networking without the awkwardness','Career',0,1050,1110,'Career Studio','Career','Coffee & snacks',0,'open','Try approachable ways to start a professional conversation.','HELLO / NEXT'],
['Learning analytics reading group','Academic',2,840,930,'Seminar Room 2','AI & education','Unknown',0,'open','Read and discuss a fictional learning-analytics case study.','READ / QUESTION'],
['Picnic and lawn games','Social',0,1080,1170,'South Lawn','Social','Free meal',0,'open','A relaxed evening of games and a picnic meal.','PLAY / CONNECT'],
['Arts collective welcome','Social',1,1020,1080,'Gallery Foyer','Arts & culture','Coffee & snacks',0,'open','Meet student artists and see works in progress.','MAKE / BELONG'],
['Resume peer review','Career',2,720,780,'Career Studio','Career','None',0,'open','Trade feedback on a fictional resume in a guided practice session.','REFINE / APPLY'],
['Quiet writing hour','Wellbeing',3,720,765,'Library Studio','Wellbeing','None',0,'open','A calm, structured writing session with a short break.','FOCUS / FLOW'],
['AI ethics debate','Academic',4,840,930,'Seminar Room 2','AI & education','None',0,'open','Explore trade-offs in using AI for student support.','ASK / CHALLENGE'],
['Weekend connections mixer','Social',4,1140,1230,'Campus Commons','Social','Unknown',0,'open','A casual chance to meet students beyond your department.','NEW / CONNECTIONS'],
['Social impact project fair','Career',3,990,1050,'Community Hall','Career','None',0,'open','Explore example project teams working on community challenges.','PURPOSE / WORK'],
['Ceramics beginner workshop','Workshops',2,1080,1170,'Arts Studio','Arts & culture','None',12,'open','Try hand-building a small ceramic form with guided instruction.','SHAPE / CREATE'],
['Research methods clinic','Academic',0,780,840,'Seminar Room 2','AI & education','None',0,'full','Small-group support for research design; demo capacity is full.','ASK / REFINE']];
export const EVENTS=records.map((r,i)=>({id:`e${i+1}`,title:r[0],category:r[1],day:r[2],start:r[3],end:r[4],location:r[5],topic:r[6],food:r[7],cost:r[8],access:r[9],description:r[10],poster:r[11],source:`Original fictional record CC-${String(i+1).padStart(3,'0')}`,checked:'October 15, 2026',rsvp:i%3===0?'RSVP required':'Drop-in welcome'}));
export const time=m=>`${Math.floor(m/60)%12||12}${m%60?':'+String(m%60).padStart(2,'0'):''} ${m>=720?'PM':'AM'}`;
export const when=e=>`${DAYS[e.day]}, Oct ${19+e.day} · ${time(e.start)}–${time(e.end)}`;
