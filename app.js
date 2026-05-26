    const { createApp } = Vue;

        const api = axios.create({ baseURL: '/api' });

        createApp({
            data() {
                return {
                    currentView: 'dashboard',
                    sidebarOpen: false,
                    isDarkMode: localStorage.getItem('theme') === 'dark',
                    
                    // Dados
                    clientes: [],
                    agendamentos: [],
                    dashboardData: {},
                    estatisticasData: {},
                    
                    // Filtros
                    filtros: { data: '', status: '', busca: '' },
                    buscaCliente: '',
                    
                    // Modais e Forms
                    showModalAgendamento: false,
                    showModalCliente: false,
                    showDeleteModal: false,
                    deleteType: '',
                    deleteId: null,
                    
                    agendamentoForm: { cliente_id: '', servico: '', data: '', hora: '', status: 'pendente', observacoes: '' },
                    clienteForm: { nome: '', telefone: '', email: '' },
                    
                    // UI
                    toasts: [],
                    toastId: 0,
                    
                    chartDiasInstance: null,
                    chartStatusInstance: null
                }
            },
            computed: {
                agendamentosFiltrados() {
                    return this.agendamentos.filter(ag => {
                        const matchData = !this.filtros.data || ag.data === this.filtros.data;
                        const matchStatus = !this.filtros.status || ag.status === this.filtros.status;
                        const buscaL = this.filtros.busca.toLowerCase();
                        const matchBusca = !buscaL || 
                            (ag.clientes?.nome && ag.clientes.nome.toLowerCase().includes(buscaL)) ||
                            (ag.servico && ag.servico.toLowerCase().includes(buscaL));
                        return matchData && matchStatus && matchBusca;
                    });
                },
                clientesFiltrados() {
                    const busca = this.buscaCliente.toLowerCase();
                    if (!busca) return this.clientes;
                    return this.clientes.filter(c => 
                        c.nome.toLowerCase().includes(busca) || 
                        c.telefone.includes(busca)
                    );
                }
            },
            methods: {
                toggleTheme() {
                    this.isDarkMode = !this.isDarkMode;
                    const theme = this.isDarkMode ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', theme);
                    localStorage.setItem('theme', theme);
                    
                    // Atualizar modo do chart se necessário
                    if (this.currentView === 'estatisticas') {
                        this.renderCharts();
                    }
                },
                changeView(view) {
                    this.currentView = view;
                    this.sidebarOpen = false;
                    if (view === 'dashboard') this.loadDashboard();
                    if (view === 'agenda') { this.loadAgendamentos(); this.loadClientes(); }
                    if (view === 'clientes') this.loadClientes();
                    if (view === 'estatisticas') this.loadEstatisticas();
                },
                showToast(message, type = 'success') {
                    const id = this.toastId++;
                    this.toasts.push({ id, message, type });
                    setTimeout(() => {
                        this.toasts = this.toasts.filter(t => t.id !== id);
                    }, 3000);
                },
                formatarData(dataStr) {
                    if (!dataStr) return '';
                    const [y, m, d] = dataStr.split('-');
                    return `${d}/${m}/${y}`;
                },
                
                // --- API Calls ---
                async loadDashboard() {
                    try {
                        const res = await api.get('/dashboard');
                        this.dashboardData = res.data;
                    } catch (e) {
                        this.showToast('Erro ao carregar dashboard', 'error');
                    }
                },
                async loadClientes() {
                    try {
                        const res = await api.get('/clientes');
                        this.clientes = res.data;
                    } catch (e) {
                        this.showToast('Erro ao carregar clientes', 'error');
                    }
                },
                async loadAgendamentos() {
                    try {
                        const res = await api.get('/agendamentos');
                        this.agendamentos = res.data;
                    } catch (e) {
                        this.showToast('Erro ao carregar agendamentos', 'error');
                    }
                },
                async loadEstatisticas() {
                    try {
                        const res = await api.get('/estatisticas');
                        this.estatisticasData = res.data;
                        this.$nextTick(() => {
                            this.renderCharts();
                        });
                    } catch (e) {
                        this.showToast('Erro ao carregar estatísticas', 'error');
                    }
                },

                // --- Operações Cliente ---
                openClienteModal(cliente = null) {
                    if (cliente) {
                        this.clienteForm = { ...cliente };
                    } else {
                        this.clienteForm = { nome: '', telefone: '', email: '' };
                    }
                    this.showModalCliente = true;
                },
                async saveCliente() {
                    try {
                        if (this.clienteForm.id) {
                            await api.put(`/clientes/${this.clienteForm.id}`, this.clienteForm);
                            this.showToast('Cliente atualizado!');
                        } else {
                            await api.post('/clientes', this.clienteForm);
                            this.showToast('Cliente criado!');
                        }
                        this.showModalCliente = false;
                        this.loadClientes();
                    } catch (e) {
                        this.showToast(e.response?.data?.error || 'Erro ao salvar cliente', 'error');
                    }
                },

                // --- Operações Agendamento ---
                openAgendamentoModal(agendamento = null) {
                    if (this.clientes.length === 0) this.loadClientes();
                    if (agendamento) {
                        this.agendamentoForm = { ...agendamento, hora: agendamento.hora.substring(0,5) };
                    } else {
                        this.agendamentoForm = { cliente_id: '', servico: '', data: '', hora: '', status: 'pendente', observacoes: '' };
                    }
                    this.showModalAgendamento = true;
                },
                async saveAgendamento() {
                    try {
                        // Converter hora para formato correto HH:MM:SS para o banco se necessário, mas HH:MM funciona
                        if (this.agendamentoForm.id) {
                            await api.put(`/agendamentos/${this.agendamentoForm.id}`, this.agendamentoForm);
                            this.showToast('Agendamento atualizado!');
                        } else {
                            await api.post('/agendamentos', this.agendamentoForm);
                            this.showToast('Agendamento criado!');
                        }
                        this.showModalAgendamento = false;
                        this.loadAgendamentos();
                    } catch (e) {
                        this.showToast(e.response?.data?.error || 'Erro ao salvar agendamento', 'error');
                    }
                },

                // --- Exclusão ---
                confirmDelete(type, id) {
                    this.deleteType = type;
                    this.deleteId = id;
                    this.showDeleteModal = true;
                },
                async executeDelete() {
                    try {
                        await api.delete(`/${this.deleteType}s/${this.deleteId}`);
                        this.showToast('Registro excluído!');
                        this.showDeleteModal = false;
                        if (this.deleteType === 'cliente') this.loadClientes();
                        if (this.deleteType === 'agendamento') this.loadAgendamentos();
                    } catch (e) {
                        this.showToast('Erro ao excluir', 'error');
                    }
                },

                // --- Gráficos ---
                renderCharts() {
                    if (!this.estatisticasData.agendamentosPorDia) return;

                    // Destruir instâncias anteriores
                    if (this.chartDiasInstance) this.chartDiasInstance.destroy();
                    if (this.chartStatusInstance) this.chartStatusInstance.destroy();
                    
                    const textColor = this.isDarkMode ? '#94A3B8' : '#64748B';
                    const gridColor = this.isDarkMode ? '#1E293B' : '#E2E8F0';

                    Chart.defaults.color = textColor;

                    // Gráfico de Barras (Últimos 7 dias)
                    const ctxDias = document.getElementById('chartDias');
                    if (ctxDias) {
                        const labelsDias = Object.keys(this.estatisticasData.agendamentosPorDia).map(d => this.formatarData(d).substring(0,5));
                        const dataDias = Object.values(this.estatisticasData.agendamentosPorDia);
                        
                        this.chartDiasInstance = new Chart(ctxDias, {
                            type: 'bar',
                            data: {
                                labels: labelsDias,
                                datasets: [{
                                    label: 'Agendamentos',
                                    data: dataDias,
                                    backgroundColor: '#3B82F6',
                                    borderRadius: 4
                                }]
                            },
                            options: { 
                                responsive: true, 
                                scales: { 
                                    y: { 
                                        beginAtZero: true, 
                                        ticks: { stepSize: 1, color: textColor },
                                        grid: { color: gridColor }
                                    },
                                    x: {
                                        ticks: { color: textColor },
                                        grid: { display: false }
                                    }
                                } 
                            }
                        });
                    }

                    // Gráfico de Rosca (Status)
                    const ctxStatus = document.getElementById('chartStatus');
                    if (ctxStatus) {
                        const { confirmado, pendente, cancelado } = this.estatisticasData.agendamentosPorStatus;
                        this.chartStatusInstance = new Chart(ctxStatus, {
                            type: 'doughnut',
                            data: {
                                labels: ['Confirmado', 'Pendente', 'Cancelado'],
                                datasets: [{
                                    data: [confirmado || 0, pendente || 0, cancelado || 0],
                                    backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                                    borderWidth: this.isDarkMode ? 0 : 2,
                                    borderColor: this.isDarkMode ? 'transparent' : '#ffffff'
                                }]
                            },
                            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor } } } }
                        });
                    }
                }
            },
            mounted() {
                if (this.isDarkMode) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                }
                this.loadDashboard();
            }
        }).mount('#app');
    