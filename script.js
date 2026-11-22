/* =========================================
   STUDY HUB - SISTEMA PRINCIPAL
========================================= */

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "studyHubData_v1";

const defaultData = {
    profile: {
        name: "Estudante",
        school: "",
        grade: ""
    },
    subjects: [],
    exams: [],
    tasks: [],
    materials: []
};

let data = loadData();
let selectedFiles = [];

/* =========================================
   ARMAZENAMENTO
========================================= */

function loadData() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return {
            ...defaultData,
            ...(saved || {}),
            profile: { ...defaultData.profile, ...(saved?.profile || {}) },
            subjects: saved?.subjects || [],
            exams: saved?.exams || [],
            tasks: saved?.tasks || [],
            materials: saved?.materials || []
        };
    } catch {
        return structuredClone(defaultData);
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function createId() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatDate(date) {
    return new Date(date + "T12:00:00").toLocaleDateString("pt-BR");
}

function todayString() {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000)
        .toISOString().slice(0, 10);
}

/* =========================================
   BANCO DE ARQUIVOS - INDEXEDDB
   Fotos e PDFs ficam no navegador.
========================================= */

const DB_NAME = "StudyHubFiles";
const STORE_NAME = "materials";

function openDatabase() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("Armazenamento de arquivos não disponível."));
            return;
        }

        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {
                    keyPath: "id"
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveFile(fileData) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");

        transaction.objectStore(STORE_NAME).put(fileData);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

async function getFile(id) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).get(id);

        request.onsuccess = () => {
            db.close();
            resolve(request.result);
        };

        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

async function deleteFile(id) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");

        transaction.objectStore(STORE_NAME).delete(id);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

/* =========================================
   NAVEGAÇÃO
========================================= */

const navButtons = document.querySelectorAll("[data-page]");
const pages = document.querySelectorAll(".page");

function showPage(pageName) {
    pages.forEach(page => {
        page.classList.toggle("active", page.id === pageName);
    });

    navButtons.forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );
    });

    const titles = {
        inicio: "Início",
        materias: "Minhas matérias",
        materiais: "Meus materiais",
        provas: "Semana de provas",
        videoaulas: "Videoaulas",
        assistente: "Assistente IA",
        perfil: "Meu perfil"
    };

    $("pageTitle").textContent = titles[pageName] || "Study Hub";

    $("sidebar").classList.remove("open");

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageName === "inicio") renderDashboard();
}

navButtons.forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.page);
    });
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.go);
    });
});

$("mobileMenu").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
});

/* =========================================
   PERFIL
========================================= */

function renderProfile() {
    $("profileName").value = data.profile.name || "";
    $("profileSchool").value = data.profile.school || "";
    $("profileGrade").value = data.profile.grade || "";

    const name = data.profile.name || "Estudante";

    $("welcomeName").textContent = name;
    $("topUserName").textContent = name;
    $("userAvatar").textContent = name.charAt(0).toUpperCase();
}

$("profileForm").addEventListener("submit", event => {
    event.preventDefault();

    data.profile = {
        name: $("profileName").value.trim(),
        school: $("profileSchool").value.trim(),
        grade: $("profileGrade").value
    };

    saveData();
    renderProfile();

    alert("Perfil atualizado com sucesso! 💙");
});

/* =========================================
   MATÉRIAS
========================================= */

$("subjectForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("subjectName").value.trim();
    const teacher = $("subjectTeacher").value.trim();

    if (!name) return;

    if (data.subjects.some(subject =>
        subject.name.toLowerCase() === name.toLowerCase()
    )) {
        alert("Essa matéria já está cadastrada!");
        return;
    }

    data.subjects.push({
        id: createId(),
        name,
        teacher
    });

    saveData();

    $("subjectForm").reset();

    renderAll();

    alert("Matéria adicionada! 📚");
});

function renderSubjects() {
    const container = $("subjectsList");

    if (data.subjects.length === 0) {
        container.innerHTML =
            '<div class="empty-state">Você ainda não adicionou matérias.</div>';
    } else {
        container.innerHTML = data.subjects.map(subject => `
            <article class="subject-card">
                <div class="subject-symbol">▤</div>
                <h3>${escapeHTML(subject.name)}</h3>
                <p>${escapeHTML(subject.teacher || "Sem professor cadastrado")}</p>
                <button class="delete-button"
                    data-delete-subject="${escapeHTML(subject.id)}">
                    Excluir matéria
                </button>
            </article>
        `).join("");
    }

    document.querySelectorAll("[data-delete-subject]").forEach(button => {
        button.addEventListener("click", () => {
            const id = button.dataset.deleteSubject;

            const linked = data.exams.some(exam => exam.subjectId === id);

            if (linked) {
                alert("Essa matéria possui provas cadastradas. Exclua as provas primeiro.");
                return;
            }

            if (!confirm("Deseja realmente excluir essa matéria?")) return;

            data.subjects = data.subjects.filter(item => item.id !== id);
            saveData();
            renderAll();
        });
    });

    const options = data.subjects.map(subject => `
        <option value="${escapeHTML(subject.id)}">
            ${escapeHTML(subject.name)}
        </option>
    `).join("");

    $("fileSubject").innerHTML =
        '<option value="">Sem matéria específica</option>' + options;

    $("examSubject").innerHTML =
        '<option value="">Selecione uma matéria</option>' + options;

    $("videoSubject").innerHTML =
        '<option value="">Escolha uma matéria</option>' + options;

    $("aiSubject").innerHTML =
        '<option value="">Geral</option>' + options;
}

/* =========================================
   MATERIAIS E UPLOADS
========================================= */

$("fileInput").addEventListener("change", event => {
    selectedFiles = Array.from(event.target.files);

    $("selectedFiles").textContent = selectedFiles.length
        ? selectedFiles.map(file => file.name).join(" • ")
        : "";
});

$("fileForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (selectedFiles.length === 0) {
        alert("Selecione pelo menos um arquivo.");
        return;
    }

    const invalidFile = selectedFiles.find(file => {
        const validType =
            file.type === "application/pdf" ||
            file.type.startsWith("image/");

        return !validType || file.size > 15 * 1024 * 1024;
    });

    if (invalidFile) {
        alert("Use somente fotos ou PDFs de até 15 MB por arquivo.");
        return;
    }

    const button = $("fileForm").querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Salvando...";

    try {
        for (const file of selectedFiles) {
            const id = createId();

            await saveFile({
                id,
                blob: file,
                name: file.name,
                type: file.type
            });

            data.materials.push({
                id,
                name: file.name,
                type: file.type,
                description: $("fileDescription").value.trim(),
                subjectId: $("fileSubject").value,
                date: todayString()
            });
        }

        saveData();

        $("fileForm").reset();
        $("selectedFiles").textContent = "";
        selectedFiles = [];

        renderAll();

        alert("Seus materiais foram salvos! 💙");

    } catch (error) {
        console.error(error);
        alert("Não foi possível salvar os arquivos. Verifique o espaço disponível no navegador.");
    } finally {
        button.disabled = false;
        button.textContent = "Salvar materiais";
    }
});

async function renderMaterials() {
    const container = $("materialsList");

    if (data.materials.length === 0) {
        container.innerHTML =
            '<div class="empty-state">Nenhum material enviado ainda.</div>';
        return;
    }

    container.innerHTML = data.materials.map(material => {
        const subject = data.subjects.find(
            item => item.id === material.subjectId
        );

        const isPdf = material.type === "application/pdf";

        return `
            <article class="material-card">
                <div class="file-symbol">${isPdf ? "📄" : "🖼️"}</div>
                <h3>${escapeHTML(material.description || material.name)}</h3>
                <p>${escapeHTML(material.name)}</p>
                <p>${escapeHTML(subject?.name || "Sem matéria")}</p>
                <p>Adicionado em ${formatDate(material.date)}</p>
                <div class="material-actions">
                    <button data-open-file="${escapeHTML(material.id)}">
                        Abrir arquivo
                    </button>
                    <button data-delete-file="${escapeHTML(material.id)}">
                        Excluir
                    </button>
                </div>
            </article>
        `;
    }).join("");

    document.querySelectorAll("[data-open-file]").forEach(button => {
        button.addEventListener("click", async () => {
            try {
                const file = await getFile(button.dataset.openFile);

                if (!file) throw new Error("Arquivo não encontrado.");

                const url = URL.createObjectURL(file.blob);
                const link = document.createElement("a");

                link.href = url;
                link.target = "_blank";
                link.rel = "noopener";
                link.click();

                setTimeout(() => URL.revokeObjectURL(url), 60000);

            } catch (error) {
                alert("Não foi possível abrir esse arquivo.");
            }
        });
    });

    document.querySelectorAll("[data-delete-file]").forEach(button => {
        button.addEventListener("click", async () => {
            if (!confirm("Excluir esse material?")) return;

            try {
                await deleteFile(button.dataset.deleteFile);

                data.materials = data.materials.filter(
                    item => item.id !== button.dataset.deleteFile
                );

                saveData();
                renderAll();

            } catch (error) {
                alert("Não foi possível excluir o arquivo.");
            }
        });
    });
}

/* =========================================
   PROVAS
========================================= */

$("examDate").min = todayString();

$("examForm").addEventListener("submit", event => {
    event.preventDefault();

    const subjectId = $("examSubject").value;
    const date = $("examDate").value;
    const topics = $("examTopics").value
        .split(/[,;\n]+/)
        .map(topic => topic.trim())
        .filter(Boolean);

    if (!subjectId || !date || topics.length === 0) {
        alert("Preencha todos os campos da prova.");
        return;
    }

    if (date < todayString()) {
        alert("Escolha uma data de hoje em diante.");
        return;
    }

    data.exams.push({
        id: createId(),
        subjectId,
        date,
        topics
    });

    data.tasks = [];

    saveData();

    $("examForm").reset();
    $("examDate").min = todayString();

    $("planResult").innerHTML = "";

    renderAll();

    alert("Prova cadastrada! Agora podemos organizar seus estudos.");
});

function renderExams() {
    const container = $("examsList");

    const exams = [...data.exams].sort(
        (a, b) => a.date.localeCompare(b.date)
    );

    if (exams.length === 0) {
        container.innerHTML =
            '<div class="empty-state">Você ainda não cadastrou provas.</div>';
    } else {
        container.innerHTML = exams.map(exam => {
            const subject = data.subjects.find(
                item => item.id === exam.subjectId
            );

            return `
                <article class="exam-card">
                    <div class="exam-date">▦ ${formatDate(exam.date)}</div>
                    <h3>${escapeHTML(subject?.name || "Matéria removida")}</h3>
                    <p><strong>Conteúdos:</strong></p>
                    <p>${exam.topics.map(escapeHTML).join(", ")}</p>
                    <button class="delete-button"
                        data-delete-exam="${escapeHTML(exam.id)}">
                        Excluir prova
                    </button>
                </article>
            `;
        }).join("");
    }

    document.querySelectorAll("[data-delete-exam]").forEach(button => {
        button.addEventListener("click", () => {
            if (!confirm("Excluir essa prova?")) return;

            data.exams = data.exams.filter(
                exam => exam.id !== button.dataset.deleteExam
            );

            data.tasks = [];

            saveData();
            $("planResult").innerHTML = "";
            renderAll();
        });
    });
}

/* =========================================
   GERADOR DE CRONOGRAMA
========================================= */

$("generatePlan").addEventListener("click", generatePlan);

function generatePlan() {
    const today = todayString();
    const minutes = Number($("dailyMinutes").value);

    const futureExams = data.exams
        .filter(exam => exam.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (futureExams.length === 0) {
        alert("Cadastre pelo menos uma prova para montar seu cronograma.");
        return;
    }

    const plan = {};

    function addTask(date, subject, topic, isReview = false) {
        if (!plan[date]) plan[date] = [];

        plan[date].push({
            id: createId(),
            subject,
            topic,
            isReview,
            done: false
        });
    }

    futureExams.forEach(exam => {
        const subject = data.subjects.find(
            item => item.id === exam.subjectId
        );

        if (!subject) return;

        const topics = exam.topics;

        const start = new Date(today + "T12:00:00");
        const end = new Date(exam.date + "T12:00:00");

        const daysUntil = Math.round(
            (end - start) / 86400000
        );

        if (daysUntil === 0) {
            addTask(today, subject.name,
                "Revisão final: " + topics.join(", "), true);
            return;
        }

        // Distribui os conteúdos entre hoje e a véspera da prova.
        const availableDays = daysUntil;
        const topicsPerDay = Math.max(
            1,
            Math.ceil(topics.length / availableDays)
        );

        let index = 0;

        for (let day = 0; day < availableDays && index < topics.length; day++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + day);

            const date = [
                currentDate.getFullYear(),
                String(currentDate.getMonth() + 1).padStart(2, "0"),
                String(currentDate.getDate()).padStart(2, "0")
            ].join("-");

            const dailyTopics = topics.slice(
                index,
                index + topicsPerDay
            );

            addTask(
                date,
                subject.name,
                dailyTopics.join(", ")
            );

            index += topicsPerDay;
        }

        // Se houver espaço, deixa uma revisão na véspera.
        if (topics.length > 0 && daysUntil > 1) {
            const lastDay = new Date(end);
            lastDay.setDate(lastDay.getDate() - 1);

            const lastDate = [
                lastDay.getFullYear(),
                String(lastDay.getMonth() + 1).padStart(2, "0"),
                String(lastDay.getDate()).padStart(2, "0")
            ].join("-");

            addTask(
                lastDate,
                subject.name,
                "Revisão geral: " + topics.join(", "),
                true
            );
        }
    });

    data.tasks = Object.entries(plan).flatMap(([date, tasks]) =>
        tasks.map(task => ({
            ...task,
            date,
            minutes: minutes
        }))
    );

    saveData();

    renderDashboard();

    const result = $("planResult");

    const dates = Object.keys(plan).sort();

    result.innerHTML = `
        <div class="section-heading">
            <h3>Seu cronograma organizado 💙</h3>
        </div>

        ${dates.map(date => `
            <div class="planner-day">
                <h4>${formatDate(date)}</h4>
                ${plan[date].map(task => `
                    <p>
                        • <strong>${escapeHTML(task.subject)}</strong>:
                        ${escapeHTML(task.topic)}
                        ${task.isReview ? "(revisão)" : ""}
                    </p>
                `).join("")}
            </div>
        `).join("")}

        <p style="margin-top:15px;color:#91a2bc;font-size:11px;">
            O tempo selecionado é uma referência para sua rotina.
            Se houver muitas matérias no mesmo dia, ajuste os horários
            para não sobrecarregar seus estudos.
        </p>
    `;

    alert("Seu cronograma foi montado! 💙");
}

/* =========================================
   TAREFAS E PAINEL INICIAL
========================================= */

function renderDashboard() {
    const today = todayString();

    const tasks = data.tasks.filter(task => task.date === today);

    if (tasks.length === 0) {
        $("todayTasks").innerHTML =
            '<div class="empty-state">Nenhuma tarefa planejada para hoje. Cadastre suas provas para começar!</div>';
    } else {
        $("todayTasks").innerHTML = tasks.map(task => `
            <div class="task-item">
                <input type="checkbox"
                    data-task-id="${escapeHTML(task.id)}"
                    ${task.done ? "checked" : ""}>
                <div>
                    <strong>${escapeHTML(task.subject)}</strong>
                    <small>${escapeHTML(task.topic)}</small>
                </div>
            </div>
        `).join("");
    }

    document.querySelectorAll("[data-task-id]").forEach(checkbox => {
        checkbox.addEventListener("change", () => {
            const task = data.tasks.find(
                item => item.id === checkbox.dataset.taskId
            );

            if (task) {
                task.done = checkbox.checked;
                saveData();
                updateStats();
            }
        });
    });

    const exams = data.exams
        .filter(exam => exam.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4);

    if (exams.length === 0) {
        $("nextExams").innerHTML =
            '<div class="empty-state">Nenhuma prova próxima.</div>';
    } else {
        $("nextExams").innerHTML = exams.map(exam => {
            const subject = data.subjects.find(
                item => item.id === exam.subjectId
            );

            return `
                <div class="exam-item">
                    <div>
                        <strong>${escapeHTML(subject?.name || "Matéria")}</strong>
                        <small>${formatDate(exam.date)}</small>
                    </div>
                </div>
            `;
        }).join("");
    }

    updateStats();
}

function updateStats() {
    $("statSubjects").textContent = data.subjects.length;
    $("statFiles").textContent = data.materials.length;
    $("statExams").textContent = data.exams.length;
    $("statTasks").textContent = data.tasks.filter(
        task => task.done
    ).length;
}

/* =========================================
   PESQUISA DE VIDEOAULAS
========================================= */

$("videoForm").addEventListener("submit", event => {
    event.preventDefault();

    const subjectId = $("videoSubject").value;
    const topic = $("videoTopic").value.trim();

    if (!topic) return;

    const subject = data.subjects.find(
        item => item.id === subjectId
    );

    const subjectName = subject?.name || "";

    const query = `${subjectName} ${topic} aula explicação ensino médio`;
    const encodedQuery = encodeURIComponent(query);

    const results = [
        {
            title: "Videoaulas no YouTube",
            description: "Pesquise explicações, aulas completas e revisões.",
            url: `https://www.youtube.com/results?search_query=${encodedQuery}`
        },
        {
            title: "Aulas e conteúdos no Khan Academy",
            description: "Encontre materiais de aprendizagem por assunto.",
            url: `https://www.khanacademy.org/search?page_search_query=${encodedQuery}`
        },
        {
            title: "Pesquisa complementar",
            description: "Encontre explicações e materiais em sites educativos.",
            url: `https://www.google.com/search?q=${encodedQuery}`
        }
    ];

    $("videoResults").innerHTML = `
        <div class="section-heading">
            <div>
                <h2>Resultados da sua pesquisa</h2>
                <p>Assunto: ${escapeHTML(query)}</p>
            </div>
        </div>

        ${results.map(result => `
            <div class="video-result">
                <h3>${escapeHTML(result.title)}</h3>
                <p>${escapeHTML(result.description)}</p>
                <a href="${result.url}" target="_blank" rel="noopener">
                    Acessar resultados →
                </a>
            </div>
        `).join("")}

        <p style="color:#91a2bc;font-size:11px;">
            Os links abrem pesquisas. A popularidade e a qualidade
            dos vídeos precisam ser verificadas nos resultados.
        </p>
    `;
});

/* =========================================
   ASSISTENTE DE IA
   Preparado para conexão com um servidor.
========================================= */

$("aiForm").addEventListener("submit", async event => {
    event.preventDefault();

    const question = $("aiQuestion").value.trim();
    const subjectId = $("aiSubject").value;

    const subject = data.subjects.find(
        item => item.id === subjectId
    );

    const response = $("aiResponse");
    const button = $("aiForm").querySelector("button");

    if (!question) return;

    button.disabled = true;
    button.textContent = "Consultando...";

    response.textContent = "Verificando conexão com o assistente...";

    try {
        const result = await fetch("/api/assist", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question,
                subject: subject?.name || "Geral",
                grade: data.profile.grade || ""
            })
        });

        if (!result.ok) {
            throw new Error("Serviço de IA ainda não configurado.");
        }

        const answer = await result.json();

        response.textContent = answer.answer ||
            "O assistente não retornou uma resposta.";

    } catch (error) {
        response.textContent =
            "O assistente de IA ainda não está conectado. " +
            "Sua interface está preparada, mas precisamos configurar " +
            "um servidor seguro e conectar uma API de inteligência artificial. " +
            "Nenhuma chave de API deve ser colocada neste arquivo.";
    } finally {
        button.disabled = false;
        button.textContent = "✧ Enviar pergunta";
    }
});

/* =========================================
   INICIALIZAÇÃO
========================================= */

function renderAll() {
    renderSubjects();
    renderProfile();
    renderDashboard();
    renderExams();
    renderMaterials();
}

renderAll();