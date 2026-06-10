// Application State & Key Cache
let apiKey = localStorage.getItem('gemini_api_key') || '';
let activeData = null;
let teleprompterInterval = null;
let teleprompterPlaying = false;
let history = JSON.parse(localStorage.getItem('social_agent_history')) || [];

// DOM Elements
const apiKeyInput = document.getElementById('api-key');
const topicInput = document.getElementById('topic-input');
const btnRun = document.getElementById('btn-run');
const btnDemo = document.getElementById('btn-demo');
const historyList = document.getElementById('history-list');
const emptyState = document.getElementById('empty-state');
const pipelineStatus = document.getElementById('pipeline-status');
const pipelineLogs = document.getElementById('pipeline-logs');
const resultsWorkspace = document.getElementById('results-workspace');
const activeTopicTitle = document.getElementById('active-topic-title');
const headerActions = document.getElementById('workspace-header-actions');

// Modal Elements
const teleprompterOverlay = document.getElementById('teleprompter-overlay');
const btnTeleprompter = document.getElementById('btn-teleprompter');
const btnTeleClose = document.getElementById('btn-tele-close');
const btnTelePlay = document.getElementById('btn-tele-play');
const teleText = document.getElementById('tele-text');
const teleScrollContainer = document.getElementById('tele-scroll-container');
const teleSpeedInput = document.getElementById('tele-speed');
const teleSizeInput = document.getElementById('tele-size');
const promptTextSelect = document.getElementById('prompt-text-select');

// Export Button
const btnExport = document.getElementById('btn-export');

// Load API key on startup
if (apiKey) {
    apiKeyInput.value = apiKey;
}

// Save API key on change
apiKeyInput.addEventListener('change', (e) => {
    apiKey = e.target.value.trim();
    localStorage.setItem('gemini_api_key', apiKey);
});

// Event Listeners
btnRun.addEventListener('click', startPipeline);
btnDemo.addEventListener('click', startDemoPipeline);
btnExport.addEventListener('click', exportScriptData);

// Teleprompter triggers
btnTeleprompter.addEventListener('click', openTeleprompter);
btnTeleClose.addEventListener('click', closeTeleprompter);
btnTelePlay.addEventListener('click', toggleTeleprompterPlay);
teleSizeInput.addEventListener('input', updateTeleprompterFontSize);
promptTextSelect.addEventListener('change', loadTeleprompterText);

// Load search history on init
renderHistory();

// Functions for History list
function renderHistory() {
    historyList.innerHTML = '';
    history.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.textContent = item.topic;
        li.addEventListener('click', () => {
            loadHistoryItem(index);
        });
        historyList.appendChild(li);
    });
}

function saveToHistory(topic, data) {
    // Check if topic exists and remove it to push it to top
    history = history.filter(item => item.topic.toLowerCase() !== topic.toLowerCase());
    history.unshift({ topic, data });
    // Keep max 8 items
    if (history.length > 8) history.pop();
    localStorage.setItem('social_agent_history', JSON.stringify(history));
    renderHistory();
}

function loadHistoryItem(index) {
    const item = history[index];
    if (item) {
        topicInput.value = item.topic;
        activeData = item.data;
        displayResults(item.topic, item.data);
    }
}

// Log message to logs area
function logMessage(msg, type = '') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    pipelineLogs.appendChild(line);
    pipelineLogs.scrollTop = pipelineLogs.scrollHeight;
}

// Switch tabs inside main view
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

    // Find tab button matching target panel ID
    const button = Array.from(document.querySelectorAll('.tab-btn')).find(btn => {
        return btn.getAttribute('onclick').includes(tabId);
    });
    if (button) button.classList.add('active');
    document.getElementById(tabId).classList.add('active');
};

// UI Results Loader
function displayResults(topic, data) {
    emptyState.style.display = 'none';
    pipelineStatus.style.display = 'none';
    resultsWorkspace.style.display = 'block';
    headerActions.style.display = 'flex';
    activeTopicTitle.textContent = topic;

    // Load Agent 1 (Research)
    document.getElementById('geo-analysis-text').textContent = data.agent1.analysis;
    const tbody = document.getElementById('blueprint-table-body');
    tbody.innerHTML = '';
    data.agent1.blueprint.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${row.narrative}</strong></td>
            <td>${row.visual}</td>
        `;
        tbody.appendChild(tr);
    });

    // Load Agent 2 (Scripts)
    // Format visual cues elegantly with cyan badges
    const formattedYtScript = formatVisualCues(data.agent2.yt_script);
    const formattedReelScript = formatVisualCues(data.agent2.reel_script);

    document.getElementById('yt-script-content').innerHTML = formattedYtScript;
    document.getElementById('reel-script-content').innerHTML = formattedReelScript;

    // Set raw text for copies
    document.getElementById('yt-script-raw').textContent = data.agent2.yt_script;
    document.getElementById('reel-script-raw').textContent = data.agent2.reel_script;

    // Load Agent 3 (SEO)
    const titlesContainer = document.getElementById('yt-titles-container');
    titlesContainer.innerHTML = '';
    const titleCategories = ['Curiosity-driven', 'Direct / Educational', 'Short & Punchy'];
    data.agent3.yt_titles.forEach((title, idx) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.padding = '12px';
        div.style.background = 'rgba(255,255,255,0.02)';
        div.style.border = '1px solid var(--border-glass)';
        div.style.borderRadius = '8px';
        div.innerHTML = `
            <div>
                <span style="font-size: 0.7rem; color: var(--accent); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">${titleCategories[idx] || 'Title option'}</span>
                <span id="yt-title-val-${idx}" style="font-weight: 600;">${title}</span>
            </div>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="copyText('yt-title-val-${idx}')">Copy</button>
        `;
        titlesContainer.appendChild(div);
    });

    document.getElementById('yt-desc').textContent = data.agent3.yt_description;

    const tagsContainer = document.getElementById('yt-tags');
    tagsContainer.innerHTML = '';
    data.agent3.yt_tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag-chip';
        span.innerHTML = `
            #${tag}
        `;
        tagsContainer.appendChild(span);
    });

    document.getElementById('reel-caption').textContent = `${data.agent3.reel_caption}\n\n${data.agent3.reel_hashtags.map(t => t.startsWith('#') ? t : '#' + t).join(' ')}`;

    // Reset view to research tab
    switchTab('tab-research');
}

function formatVisualCues(text) {
    // Replace text inside square brackets [ANY_CUE] with span visual-cue
    return text.replace(/\[([^\]]+)\]/g, (match, p1) => {
        return `<span class="visual-cue">[Visual: ${p1}]</span>`;
    });
}

// Copy to Clipboard Utility
window.copyText = function(elementId) {
    const el = document.getElementById(elementId);
    let text = '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        text = el.value;
    } else {
        text = el.textContent || el.innerText;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('Text copied successfully!');
    }).catch(err => {
        console.error('Error copying text:', err);
    });
};

window.copyTags = function(elementId) {
    const tags = Array.from(document.getElementById(elementId).querySelectorAll('.tag-chip'))
                      .map(chip => chip.textContent.trim().replace('#', ''))
                      .join(', ');
    navigator.clipboard.writeText(tags).then(() => {
        showToast('All tags copied as comma-separated values!');
    }).catch(err => {
        console.error('Error copying tags:', err);
    });
};

function showToast(message) {
    const toast = document.getElementById('copy-toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 2500);
}

// Teleprompter Logic
function openTeleprompter() {
    if (!activeData) return;
    teleprompterOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    loadTeleprompterText();
}

function closeTeleprompter() {
    stopTeleprompterScroll();
    teleprompterOverlay.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function loadTeleprompterText() {
    const scriptType = promptTextSelect.value;
    let text = '';
    if (scriptType === 'reel') {
        text = activeData.agent2.reel_script;
    } else {
        text = activeData.agent2.yt_script;
    }
    
    // Clean up visual cues from teleprompter text for smooth reading
    const cleanText = text.replace(/\[([^\]]+)\]/g, '');
    teleText.textContent = cleanText;
    
    // Scroll back to top
    teleScrollContainer.scrollTop = 0;
    stopTeleprompterScroll();
}

function updateTeleprompterFontSize() {
    const size = teleSizeInput.value;
    teleText.style.fontSize = `${size}px`;
}

function toggleTeleprompterPlay() {
    if (teleprompterPlaying) {
        stopTeleprompterScroll();
    } else {
        startTeleprompterScroll();
    }
}

function startTeleprompterScroll() {
    teleprompterPlaying = true;
    btnTelePlay.textContent = 'Pause';
    btnTelePlay.style.background = 'var(--danger)';
    
    const scroll = () => {
        if (!teleprompterPlaying) return;
        const speed = parseInt(teleSpeedInput.value);
        // Map speed slider 1-10 to pixel steps
        const step = speed * 0.45;
        teleScrollContainer.scrollTop += step;
        
        // Stop if reached end
        if (teleScrollContainer.scrollTop >= teleScrollContainer.scrollHeight - teleScrollContainer.clientHeight) {
            stopTeleprompterScroll();
        } else {
            requestAnimationFrame(scroll);
        }
    };
    
    requestAnimationFrame(scroll);
}

function stopTeleprompterScroll() {
    teleprompterPlaying = false;
    btnTelePlay.textContent = 'Play';
    btnTelePlay.style.background = 'linear-gradient(135deg, var(--accent), var(--purple))';
}

// Export Script Utility
function exportScriptData() {
    if (!activeData) return;
    const topic = activeTopicTitle.textContent;
    const markdown = `# ${topic} - Real Life More Studio Scripts

## 🌐 Agent 1: Geographical & Science Analysis
${activeData.agent1.analysis}

## 📊 Visual Blueprint Table
| Narrative Point | Visual Clip / Animation Suggestion |
| :--- | :--- |
${activeData.agent1.blueprint.map(row => `| ${row.narrative} | ${row.visual} |`).join('\n')}

---

## 🎥 Agent 2: Documentary Script (YouTube 3-5 Mins)
${activeData.agent2.yt_script}

---

## 📱 Agent 2: Reel Script (Instagram 50-60 Secs)
${activeData.agent2.reel_script}

---

## 📈 Agent 3: SEO Assets

### YouTube Titles:
1. ${activeData.agent3.yt_titles[0]} (Curiosity-driven)
2. ${activeData.agent3.yt_titles[1]} (Direct/Educational)
3. ${activeData.agent3.yt_titles[2]} (Short & Punchy)

### YouTube Description:
${activeData.agent3.yt_description}

### YouTube Tags:
${activeData.agent3.yt_tags.join(', ')}

### Instagram Reel Caption:
${activeData.agent3.reel_caption}

### Instagram Hashtags:
${activeData.agent3.reel_hashtags.join(' ')}
`;

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${topic.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_workspace.md`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Simulation Flow using Demo Content
function startDemoPipeline() {
    const topic = topicInput.value.trim() || 'Mystery of the Mariana Trench';
    emptyState.style.display = 'none';
    resultsWorkspace.style.display = 'none';
    pipelineStatus.style.display = 'block';
    headerActions.style.display = 'none';
    activeTopicTitle.textContent = 'Running Pipeline...';
    pipelineLogs.innerHTML = '';
    
    // Set steps back to inactive
    document.getElementById('step-1').className = 'pipeline-step';
    document.getElementById('step-2').className = 'pipeline-step';
    document.getElementById('step-3').className = 'pipeline-step';

    logMessage('Starting simulation pipeline for topic: ' + topic, 'accent');
    
    setTimeout(() => {
        // Step 1: Geo Director
        document.getElementById('step-1').classList.add('active');
        logMessage('🤖 AGENT 1: Analyzing geographical coordinates & tectonic plates...');
        logMessage('Agent 1 gathering depth metrics & thermal vent anomalies...', 'accent');
        
        setTimeout(() => {
            document.getElementById('step-1').className = 'pipeline-step completed';
            document.getElementById('step-2').classList.add('active');
            logMessage('🤖 AGENT 1 completed analysis successfully.', 'success');
            logMessage('🤖 AGENT 2: Synthesizing research into premium documentary narrative script...', 'accent');
            
            setTimeout(() => {
                document.getElementById('step-2').className = 'pipeline-step completed';
                document.getElementById('step-3').classList.add('active');
                logMessage('🤖 AGENT 2 generated long-form YouTube script & looping Reels script.', 'success');
                logMessage('🤖 AGENT 3: Generating viral growth metadata tags & description...', 'accent');
                
                setTimeout(() => {
                    document.getElementById('step-3').className = 'pipeline-step completed';
                    logMessage('🤖 AGENT 3 SEO checklist compiled.', 'success');
                    logMessage('🎉 Pipeline completed! Dashboard updated.', 'success');
                    
                    const demoData = getDemoData(topic);
                    activeData = demoData;
                    saveToHistory(topic, demoData);
                    
                    setTimeout(() => {
                        displayResults(topic, demoData);
                    }, 500);
                    
                }, 1200);
            }, 1500);
        }, 1500);
    }, 800);
}

// Core API Orchestrator (Google Gemini API Sequential Integration)
async function startPipeline() {
    const topic = topicInput.value.trim();
    if (!topic) {
        alert('Please enter a Geography or Earth Science topic.');
        return;
    }
    
    if (!apiKey) {
        alert('Please enter a valid Google Gemini API Key in the configuration sidebar or use Demo Mode.');
        return;
    }

    emptyState.style.display = 'none';
    resultsWorkspace.style.display = 'none';
    pipelineStatus.style.display = 'block';
    headerActions.style.display = 'none';
    activeTopicTitle.textContent = 'Running Agents...';
    pipelineLogs.innerHTML = '';

    // Reset visual indicators
    document.getElementById('step-1').className = 'pipeline-step';
    document.getElementById('step-2').className = 'pipeline-step';
    document.getElementById('step-3').className = 'pipeline-step';

    try {
        // --- Agent 1 Workflow ---
        document.getElementById('step-1').classList.add('active');
        logMessage('🚀 Initiating Agent 1: The Geo-Research & Visual Director', 'accent');
        logMessage('Agent 1 is querying tectonic databases and geological histories...');
        
        const agent1Response = await callGeminiAPI(getAgent1Prompt(topic));
        let agent1Data;
        try {
            // Clean markdown blocks ```json ... ``` if model wrapped it
            const jsonText = cleanJSONResponse(agent1Response);
            agent1Data = JSON.parse(jsonText);
        } catch (e) {
            logMessage('⚠️ JSON Parsing failed. Formatting fallback structure...', 'warning');
            agent1Data = {
                analysis: agent1Response,
                blueprint: [
                    { narrative: "Beginning of the video mystery segment", visual: "3D zoom into the geographical area on Google Earth Studio" },
                    { narrative: "Geological process description", visual: "Cross-section animation illustrating plate tectonics" }
                ]
            };
        }
        
        document.getElementById('step-1').className = 'pipeline-step completed';
        logMessage('✅ Agent 1 complete! Science outline & Visual blueprint created.', 'success');
        
        // --- Agent 2 Workflow ---
        document.getElementById('step-2').classList.add('active');
        logMessage('🚀 Initiating Agent 2: The Documentary Scriptwriter', 'accent');
        logMessage('Creating high-retention speech script with visual bracket cues...');
        
        const agent2Response = await callGeminiAPI(getAgent2Prompt(topic, agent1Data));
        let agent2Data;
        try {
            const jsonText = cleanJSONResponse(agent2Response);
            agent2Data = JSON.parse(jsonText);
        } catch (e) {
            logMessage('⚠️ Script JSON parse failed. Extracting text nodes...', 'warning');
            // Try fallback split
            const parts = agent2Response.split(/###/i);
            agent2Data = {
                yt_script: parts[0] || agent2Response,
                reel_script: parts[1] || "Reel Script: " + agent2Response
            };
        }
        
        document.getElementById('step-2').className = 'pipeline-step completed';
        logMessage('✅ Agent 2 complete! YouTube and Loop Reel scripts prepared.', 'success');
        
        // --- Agent 3 Workflow ---
        document.getElementById('step-3').classList.add('active');
        logMessage('🚀 Initiating Agent 3: The SEO & Viral Growth Manager', 'accent');
        logMessage('Evaluating keyword matrices and CTR titling schemas...');
        
        const agent3Response = await callGeminiAPI(getAgent3Prompt(topic, agent2Data));
        let agent3Data;
        try {
            const jsonText = cleanJSONResponse(agent3Response);
            agent3Data = JSON.parse(jsonText);
        } catch (e) {
            logMessage('⚠️ SEO JSON extraction error. Falling back to structure...', 'warning');
            agent3Data = {
                yt_titles: [topic + " Mystery", "The Dark Truth of " + topic, "What Scientists Just Found in " + topic],
                yt_description: "Deep dive into the science of " + topic + ". Discover what scientists just uncovered.",
                yt_tags: [topic, "geography", "documentary", "science", "earth"],
                reel_caption: "Uncovering the secret of " + topic + "! Comment below what you think.",
                reel_hashtags: ["geography", "earthscience", "nature", "reels"]
            };
        }
        
        document.getElementById('step-3').className = 'pipeline-step completed';
        logMessage('✅ Agent 3 complete! SEO matrices and tags cataloged.', 'success');
        logMessage('🎉 All Agents complete! Loading Workspace...', 'success');

        const pipelineOutput = {
            agent1: agent1Data,
            agent2: agent2Data,
            agent3: agent3Data
        };

        activeData = pipelineOutput;
        saveToHistory(topic, pipelineOutput);
        
        setTimeout(() => {
            displayResults(topic, pipelineOutput);
        }, 800);

    } catch (error) {
        logMessage('❌ PIPELINE CRITICAL ERROR: ' + error.message, 'danger');
        console.error(error);
        alert('Pipeline Error: ' + error.message);
    }
}

// API Fetch Core Utility
async function callGeminiAPI(promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
        contents: [{
            parts: [{ text: promptText }]
        }],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || response.statusText;
        throw new Error(`Gemini API Call Failed: ${errMsg}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Clean model output wrapper
function cleanJSONResponse(rawText) {
    let clean = rawText.trim();
    if (clean.startsWith('```')) {
        clean = clean.replace(/^```json/i, '').replace(/```$/, '').trim();
    }
    return clean;
}

// --- PROMPT TEMPLATE BUILDERS ---

function getAgent1Prompt(topic) {
    return `You are AGENT 1: THE GEO-RESEARCH & VISUAL DIRECTOR of 'Real Life More Studio'.
Analyze the core science/geography behind this topic: "${topic}".
Write your results strictly in JSON format. Do not add markdown backticks outside of the JSON text.

Language Requirements:
- Use immersive, premium Hinglish (Hindi text in English script, e.g., "Yeh sabse bada rahasya hai jise aaj tak solve nahi kiya gaya").
- Keep all technical terms strictly in English (e.g., tectonic plates, sediment erosion, subduction zone, mantle convection, hydrothermal vents).
- Maintain a serious, mysterious, and highly engaging documentary tone.

Your output JSON must exactly follow this schema:
{
  "analysis": "A detailed 2-3 paragraph Hinglish summary analyzing the core science, geographical anomaly, and historical facts of the topic.",
  "blueprint": [
    {
      "narrative": "A specific narrative point in Hinglish matching the chronological structure of the topic.",
      "visual": "Exact instructions for what clip/animation to show (e.g. 3D globe zoom, historical map overlay, stock footage of deep sea vents) and where the editor can fetch it (e.g. Google Earth Studio, Pexels, Storyblocks, NASA archive)."
    }
  ]
}

Provide 4 to 6 entries in the blueprint list.`;
}

function getAgent2Prompt(topic, agent1Data) {
    const researchStr = JSON.stringify(agent1Data);
    return `You are AGENT 2: THE DOCUMENTARY SCRIPTWRITER of 'Real Life More Studio'.
Create two high-retention scripts based on this geographical research data: ${researchStr}.
Write your results strictly in JSON format. Do not add markdown backticks outside of the JSON text.

Language Requirements:
- High-quality Hinglish (English alphabets, keeping technical geography terms in English).
- Serious, analytical, and mysterious documentary tone.

Your output JSON must exactly follow this schema:
{
  "yt_script": "Long form YouTube script text here...",
  "reel_script": "Reel script text here..."
}

YouTube Script Rules (3-5 minutes, approximately 400-600 words):
- Start with a gripping psychological hook. Do NOT say 'Hello guys' or 'Welcome to my channel'. Jump straight into the mystery/shocking fact.
- Break the script into logical chapters with clear headers (e.g., Chapter 1: The Dark Discovery).
- Embed [VISUAL CUES] from Agent 1 inside brackets seamlessly inside the speech text (e.g., 'Sadiyon se yeh jagah humari reach ke baahar thi... [Visual: 3D globe zoom into Mariana Trench on Google Earth Studio] aur jab hum pehli baar wahan pahunche...').
- End the script with a thought-provoking, controversial question to drive comments.

Instagram Reels Script Rules (50-60 seconds, approximately 130-150 words):
- Fast-paced, high impact.
- Start with an instant hook.
- Embed 2-3 visual cues inside brackets.
- The script MUST end with a 'Seamless Loop Line' that perfectly connects back to the first sentence of the script, so that the video loops infinitely without a visible cut. Make sure the transition makes logical sense.`;
}

function getAgent3Prompt(topic, agent2Data) {
    const scriptsStr = JSON.stringify(agent2Data);
    return `You are AGENT 3: THE SEO & VIRAL GROWTH MANAGER of 'Real Life More Studio'.
Generate SEO assets and metadata for this script bundle: ${scriptsStr}.
Write your results strictly in JSON format. Do not add markdown backticks outside of the JSON text.

Your output JSON must exactly follow this schema:
{
  "yt_titles": [
    "Curiosity-driven high CTR Title (e.g., Mariana Trench Ke Niche Kuch Aisa Mila Jo Impossible Tha...)",
    "Direct / Educational high CTR Title",
    "Short & Punchy high CTR Title (less than 50 characters)"
  ],
  "yt_description": "A compelling 3-sentence description optimized for YouTube SEO containing keywords. Write in Hinglish but explain clearly what the video covers.",
  "yt_tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13", "tag14", "tag15"],
  "reel_caption": "Engaging Instagram Reel caption in Hinglish that ends with a clear Call-to-Action (CTA) encouraging users to comment their opinion.",
  "reel_hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5", "hashtag6", "hashtag7", "hashtag8", "hashtag9", "hashtag10", "hashtag11", "hashtag12", "hashtag13", "hashtag14", "hashtag15", "hashtag16", "hashtag17", "hashtag18", "hashtag19", "hashtag20"]
}

Ensure the tags list contains exactly 15 high-volume search tags and the hashtags list contains exactly 20 highly viral hashtags.`;
}

// --- HIGH-QUALITY PRE-WRITTEN DEMO CONTENT ---
function getDemoData(topic) {
    const lowerTopic = topic.toLowerCase();
    
    if (lowerTopic.includes('sahara') || lowerTopic.includes('green')) {
        return {
            agent1: {
                analysis: "Lagbhag 5,000 to 11,000 saal pehle, jise African Humid Period kaha jata hai, Sahara Desert ek sookha registan nahi balki ek hara-bhara grassland tha. Earth ke axial precession (rotation wobble) ke badlav ke karan monsoon patterns shift hue, jiski wajah se is pure region mein ghani haryali aur badi badi jheelein (jaise Lake Mega-Chad) bani thi. Is sudden climate swing ne ek green paradise ko dhire-dhire duniyaghar ke sabse bade desert mein tabdeel kar diya.",
                blueprint: [
                    { narrative: "Sahara ki tapti ret aur wahan mile ajeeb rahasya ki shuruat", visual: "3D zoom from outer space into the center of Sahara Desert - Source: Google Earth Studio" },
                    { narrative: "Purani rock paintings jo Sahara mein haryali aur animals show karti hain", visual: "Macro shot of Cave of Swimmers rock art showing swimming humans and giraffes - Source: Pexels / Stock Footage" },
                    { narrative: "Milankovitch cycles ke badlaav se badla monsoon axis", visual: "3D animated diagram of Earth wobbling on its axis with orbital cycles explained - Source: NASA archive / Blender render" },
                    { narrative: "Badi jheelein dry up ho gayin aur ret ne pure jungle ko daba diya", visual: "Time-lapse transition showing fertile soil cracking and dry sand blowing over it - Source: Storyblocks" }
                ]
            },
            agent2: {
                yt_script: `[Visual: 3D zoom from outer space into the center of Sahara Desert - Source: Google Earth Studio]
Kya aap believe karenge ki jis jagah par aaj paani ki ek boond tak nasib nahi hoti, wahan kabhi badi-badi jheelein aur hare-bhare jungle hua karte the? 

Hum baat kar rahe hain Sahara Desert ki. Lekin sadiyon se chupa yeh rahasya achanak tab khula jab scientists ko Sahara ki ret ke niche kuch aisa mila jisne unhe hairan kar diya.

### Chapter 1: Cave of Swimmers
[Visual: Macro shot of Cave of Swimmers rock art showing swimming humans and giraffes - Source: Pexels]
Sahara ke bilkul beech mein rock art mili, jisme log swimming kar rahe hain aur wahan giraffes aur crocodiles ki paintings bani hain. Ek tapti hui ret ke samandar mein swimming paintings? Yeh kaise possible hai?

### Chapter 2: The Earth's Wobble
[Visual: 3D animated diagram of Earth wobbling on its axis - Source: NASA]
Scientists ne discover kiya ki lagbhag 10,000 saal pehle Earth ka tilt aur tilt cycle alag tha, jise Milankovitch Cycle kehte hain. Precession ke karan monsoon ka dhaar badal gaya aur Sahara ban gaya ek green paradise. Lekin ek cycle phir badla, aur is paradise ko mitti mein mila diya.

Kya aapko lagta hai ki human actions ke bina bhi nature hamari poori civilization ko ek jhatke mein erase kar sakti hai? Comment karke bataiye!`,
                reel_script: `[Visual: 3D zoom from outer space into Sahara - Google Earth Studio]
Sahara Desert ki tapti ret ke niche ek pura hara-bhara jungle aur badi jheelein dabi hui hain!
[Visual: Cave of Swimmers rock art - Pexels]
Lagbhag 8,000 saal pehle, Earth ki rotational tilt ke badlav se monsoon badla aur Sahara ek green forest ban gaya. Par precession cycle change hote hi green forests ret ke dher mein tabdeel ho gaye.
[Visual: Dry sand blowing over cracking soil - Storyblocks]
Yeh cycle phir se paltega aur Sahara dobara green ho jayega kyunki Sahara Desert ki tapti ret ke niche ek pura hara-bhara jungle dabi hui hai!`
            },
            agent3: {
                yt_titles: [
                    "Sahara Desert Ke Niche Mile Aise Saboot Jinhone Scientists Ko Dara Diya...",
                    "How the Sahara Desert Was Once Green: Earth Tectonic Cycle",
                    "The Green Sahara Mystery"
                ],
                yt_description: "Sahara Desert ke niche mile ajeeb rahasyo ki investigation. Kaise ek hara-bhara paradise Earth ke precession cycle ke badlaav se ban gaya sabse bada registan. Tectonic and climate history in Hinglish.",
                yt_tags: ["SaharaDesert", "GreenSahara", "EarthScience", "GeographyMystery", "PrecessionCycle", "Milankovitch", "ClimateChange", "TectonicPlates", "HistoricalMysteries", "DocumentaryHindi", "RealLifeMore", "YouTubeGeography", "IndianScience", "SpaceFact", "History"],
                reel_caption: "Sahara Desert kabhi ek hara bhara jungle tha! Earth ke rotational wobble ne banaya ise registan. Kya yeh dobara green hoga? Comment section mein bataiye! 👇",
                reel_hashtags: ["SaharaDesert", "GreenSahara", "Geography", "EarthScience", "Mystery", "FactSheet", "VisualStorytelling", "HinglishContent", "InstaReels", "ScienceFacts", "HistoryFacts", "DocumentaryStyle", "Precession", "NatureLover", "LearnOnReels", "ScienceHindi", "ViralFact", "TrendingAudio", "ReelLife", "Geology"]
            }
        };
    } else {
        // Default: Mariana Trench
        return {
            agent1: {
                analysis: "Mariana Trench Earth ka sabse deep point hai, jo Challenger Deep mein lagbhag 11,000 meters gahra hai. Yeh subduction zone tectonic plates (Pacific Plate slipping under the Mariana Plate) ke collide hone se banta hai. Is zone mein pressure surface se 1,000 times jyada hota hai aur temperature freezing levels par hota hai, fir bhi yahan unique hydrostatic pressure-tolerant extremophile creatures paye jate hain.",
                blueprint: [
                    { narrative: "Insaan ka ocean depth mein sabse gahra safar", visual: "3D zoom into the Western Pacific Ocean, zooming right into the Mariana Trench crescent - Source: Google Earth Studio" },
                    { narrative: "Pressure and plate boundary visuals", visual: "2D custom infographic animation showing the Pacific Plate sliding underneath the Mariana Plate - Source: Pexels / Custom graphics" },
                    { narrative: "Strange species surviving extreme conditions", visual: "Clips of biological deep-sea creatures like Mariana Snailfish or bioluminescent organisms - Source: NOAA Ocean Explorer archive" },
                    { narrative: "Thermal vents shooting toxic minerals in cold water", visual: "Close up footage of hydrothermal 'black smokers' vents spewing minerals at the trench bottom - Source: NASA / NOAA archive" }
                ]
            },
            agent2: {
                yt_script: `[Visual: 3D zoom into Western Pacific Ocean, targeting Mariana Trench - Google Earth Studio]
Kya aap believe karenge ki Mount Everest ko agar hum samandar ke sabse gahre hisse mein daal dein, toh uski peak paani ke 2 kilometer niche hi rah jayegi?

Hum baat kar rahe hain Mariana Trench ki, Earth ka sabse gahra aur mysterious abyss. Ek aisi jagah jahan pressure surface se ek hazaar guna zyada hai aur sunlight kabhi nahi pahunchti.

### Chapter 1: Challenger Deep
[Visual: Infographic showing subduction zone tectonic movement]
Mariana Trench ka sabse gahra point hai Challenger Deep, jo lagbhag 11 kilometers deep hai. Yeh subduction zone tab banta hai jab Pacific plate, Mariana plate ke niche slide karti hai. Is process mein aisi extreme conditions banti hain jo science ke laws ko challenge karti hain.

### Chapter 2: Life in the Abyss
[Visual: Footage of Mariana Snailfish in dark water - NOAA]
Lekin sabse bada jhatka tab laga jab scientists ko is crushing pressure mein bhi ajeeb creatures mile, jaise Mariana Snailfish aur glass-like amphipods. Bina suraj ki roshni aur high toxicity ke beech hydrothermal black smokers inki energy ka source hain.

Kya Mariana Trench ke niche aisi life forms hain jo space exploration ke liye key ban sakti hain? Aapka kya sochna hai? Comment karke bataiye!`,
                reel_script: `[Visual: 3D zoom into Mariana Trench crescent - Google Earth Studio]
Mount Everest ko samandar mein phenk do, tab bhi uski peak paani ke 2 kilometer niche dub jayegi!
[Visual: Infographic of Pacific Plate sliding under Mariana Plate]
Yeh hai Mariana Trench, Challenger Deep. 11 kilometers deep, jahan subduction plate tectonics ne banaya hai ek aisa pressure zone jo kisi bhi normal cheez ko crush kar de.
[Visual: Deep-sea Mariana Snailfish - NOAA]
Lekin yahan hydro-thermal vents ke paas aisi extreme creatures jee rahe hain jo bina sunlight ke pure ecosystem ko chalate hain.
[Visual: Zoom out of ocean deep - Pexels]
Kya is andhere gahrai mein extraterrestrial life ke secrets chupe hain? Mount Everest ko samandar mein phenk do tab bhi uski peak paani ke niche hi rahegi!`
            },
            agent3: {
                yt_titles: [
                    "Mariana Trench Ke Sabse Gahraai Mein Mila Kuch Aisa Jo Impossible Tha...",
                    "Tectonic plates collision: Exploring Mariana Trench Challenger Deep",
                    "Deepest Point on Earth: Mariana Trench Mystery"
                ],
                yt_description: "Mariana Trench ke extreme depths aur Challenger Deep ki tectonic chemistry. Kaise Pacific plate aur Mariana plate subduction banati hai aur kaise strange creatures wahan survive karte hain.",
                yt_tags: ["MarianaTrench", "ChallengerDeep", "OceanMysteries", "EarthScience", "PlateTectonics", "SubductionZone", "DeepSeaCreatures", "GeologyDocumentary", "ScienceHindi", "TectonicPlates", "HydrothermalVents", "OceanSecrets", "RealLifeMore", "HindiScienceFacts", "GeographicalAnomalies"],
                reel_caption: "Mariana Trench ke sabse gahre Challenger Deep mein aisi extreme life mili hai jo science ko hairan karti hai! Kya aapko lagta hai yahan alien life ke rahasya hain? Comment karke batayein! 👇",
                reel_hashtags: ["MarianaTrench", "OceanDepth", "DeepSea", "Tectonics", "EarthScience", "ScienceMystery", "VisualBlueprint", "HindiDocumentary", "ReelsIndia", "FactVideo", "LearnScience", "Oceanography", "Extremophiles", "EarthGeology", "TrendingReels", "ScienceHinglish", "DidYouKnow", "Exploration", "AmazingFacts", "RealLifeMore"]
            }
        };
    }
}
