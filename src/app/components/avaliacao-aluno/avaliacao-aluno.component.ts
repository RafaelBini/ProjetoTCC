import { Questao } from './../../models/questao';
import { CredencialService } from './../../services/credencial.service';
import { CountdownComponent } from './../countdown/countdown.component';
import { AvaliacaoService } from 'src/app/services/avaliacao.service';
import { Prova } from 'src/app/models/prova';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Avaliacao } from 'src/app/models/avaliacao';
import { ComumService } from './../../services/comum.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { UrlNode } from 'src/app/models/url-node';
import { Subscription } from 'rxjs/internal/Subscription';
import { ProvaService } from 'src/app/services/prova.service';
import { AvaliacaoAlunoCabecalhoComponent } from './avaliacao-aluno-cabecalho/avaliacao-aluno-cabecalho.component';
import { Usuario } from 'src/app/models/usuario';
import { Grupo } from 'src/app/models/grupo';


@Component({
  selector: 'app-avaliacao-aluno',
  templateUrl: './avaliacao-aluno.component.html',
  styleUrls: ['./avaliacao-aluno.component.css']
})
export class AvaliacaoAlunoComponent implements OnInit, OnDestroy {

  constructor(public router: Router,
    public route: ActivatedRoute,
    public credencialService: CredencialService,
    public comumService: ComumService,
    private avaliacaoService: AvaliacaoService,
    private provaService: ProvaService,
    private snack: MatSnackBar) { }


  public avaliacao: Avaliacao = {
    titulo: "",
    descricao: "",
    status: 0,
    professorId: '',
    professorNome: '',
    limitarNumIntegrantes: true,
    maxIntegrantes: 3,
    correcaoParesQtdNumero: 3,
    correcaoParesQtdTipo: 'DEFINIR',
    tipoDisposicao: 2,
    tipoCorrecao: 2,
    tipoPontuacao: 0,
    grupos: [],
  }

  public gabarito: Prova = {
    questoes: [],
  }

  public prova: Prova = {
    id: '1',
    avaliacaoId: "1",
    status: 0,
    questoes: [],
    alunos: [],
    provasParaCorrigir: [

    ]
  }

  public caminho: Array<UrlNode> = [
    { nome: `Aluno`, url: `/aluno` },
    { nome: `Avaliações`, url: `/aluno/avaliacoes` },
    { nome: `${this.avaliacao.titulo}`, url: `#` },
  ];

  private avaliacaoSubscription: Subscription;
  private provaSubscription: Subscription;

  private meuGrupoTemProva: boolean = false;
  private estouIndoInserirProva = false;

  @ViewChild(CountdownComponent) countDown: CountdownComponent;

  ngOnInit(): void {

    this.route.params.subscribe(param => {
      const AVALIACAO_ID = param.id;

      // Se estou logado,
      if (this.credencialService.estouLogado()) {

        this.credencialService.loggedUser.acesso = 'aluno';

        // Começa a ouvir mudanças na avaliação
        this.avaliacaoSubscription = this.avaliacaoService.onAvaliacaoChange(AVALIACAO_ID).subscribe(avaliacao => {

          console.log("Houveram mudanças na avaliação, atualizando...");

          var avaliacaoAnterior = { ...this.avaliacao };
          this.avaliacao = avaliacao;


          if (this.avaliacao.tipoDisposicao != 0 && this.getMeuGrupoFromAvaliacao(avaliacaoAnterior) != null) {
            if (this.getMeuGrupoFromAvaliacao(avaliacaoAnterior).provaId != null && this.getMeuGrupoNaAvaliacao().provaId == null) {
              this.getMeuGrupoNaAvaliacao().provaId = this.getMeuGrupoFromAvaliacao(avaliacaoAnterior).provaId;
              this.avaliacaoService.updateAvaliacao(this.avaliacao);
              console.log("tiraram a prova do meu grupo, mas já coloquei de volta!")
              return;
            }
          }
          else if (this.avaliacao.tipoDisposicao == 0 && this.getEuFromAvaliacao(avaliacaoAnterior) != null) {
            if (this.getEuFromAvaliacao(avaliacaoAnterior).provaId != null && this.getEuNaAvaliacao().provaId == null) {

              this.getEuNaAvaliacao().provaId = this.getEuFromAvaliacao(avaliacaoAnterior).provaId;
              this.avaliacaoService.updateAvaliacao(this.avaliacao);
              console.log("tiraram a prova de mim, mas já coloquei de volta!")
              return;
            }

          }




          this.caminho = [
            { nome: `Aluno`, url: `/aluno` },
            { nome: `Avaliações`, url: `/aluno/avaliacoes` },
            { nome: `${this.avaliacao.titulo}`, url: `#` },
          ];

          // Se sou o professor dessa avaliacao, Vou para visão do professor
          if (this.avaliacao.professorId == this.credencialService.getLoggedUserIdFromCookie()) {
            this.credencialService.loggedUser.acesso = 'professor';
            this.router.navigate([`professor/avaliacao/${AVALIACAO_ID}`]);
            return;
          }

          // Me atualizar na avaliação. Se isso realmente ocorreu, encerro a inicialização aqui porque seremos chamados novamente
          if (this.meAtualizarNaAvaliacao())
            return;


          if (this.avaliacao.status == 1) {

            console.log("Estamos no status 'durante avaliacao'");


            // Se não tem gabarito ainda
            if (this.gabarito.questoes.length <= 0) {
              // Recebe o gabarito
              this.provaService.getProvaFromId(this.avaliacao.provaGabarito).then(gabarito => {
                this.gabarito = gabarito;
                this.receberProva();
              });
            }
            else {
              this.receberProva();
            }



          }
          else if (this.avaliacao.status == 2) {
            if (this.avaliacao.tipoCorrecao == 3)
              this.receberProvasCorrigir();
          }
        });
      }
      // Se não estou logado,
      else {
        this.router.navigate([`${AVALIACAO_ID}`]);
      }
    });


  }

  ngOnDestroy() {
    if (this.avaliacaoSubscription)
      this.avaliacaoSubscription.unsubscribe();
    if (this.provaSubscription)
      this.provaSubscription.unsubscribe();
  }

  @HostListener('window:beforeunload')
  beforeUnload() {
    if (this.prova != null) {
      this.meRemoverDasQuestoes();
    }

  }

  // GERAL
  getDataObjetivo() {
    if (this.avaliacao.status == 0) {
      if (this.avaliacao.isInicioIndeterminado)
        return '2020-09-05T13:55:30.000Z';
      else
        return this.avaliacao.dtInicio;
    }
    else if (this.avaliacao.status == 1) {
      if (this.avaliacao.isInicioCorrecaoIndeterminado)
        return '2020-09-05T13:55:30.000Z';
      else
        return this.avaliacao.dtInicioCorrecao;
    }
    else if (this.avaliacao.status == 2) {
      if (this.avaliacao.isTerminoIndeterminado)
        return '2020-09-05T13:55:30.000Z';
      else
        return this.avaliacao.dtTermino;
    }
    else {
      return '2020-09-05T13:55:30.000Z';
    }

  }
  getAlunosFromTodosGrupos(): Array<Usuario> {
    var alunos: Array<Usuario> = [];
    for (let grupo of this.avaliacao.grupos) {
      for (let aluno of grupo.alunos) {
        alunos.push(aluno);
      }
    }
    return alunos;
  }
  meAtualizarNaAvaliacao() {
    // Passa por cada aluno na avaliação para verificar se eu já estou na avaliação
    var estouNaAvaliacao = false;
    var mudeiAlgo = false;
    for (let grupo of this.avaliacao.grupos) {
      for (let aluno of grupo.alunos) {
        if (aluno.id == this.credencialService.getLoggedUserIdFromCookie()) {

          if (aluno.online == false) {
            aluno.online = true;
            mudeiAlgo = true;
          }

          if (this.avaliacao.status == 1 && (aluno.statusId < 2 || aluno.statusId == null)) {
            aluno.statusId = 2;
            mudeiAlgo = true;
          }

          estouNaAvaliacao = true;
          break;
        }
      }
      if (estouNaAvaliacao && mudeiAlgo) {
        console.log("Me atualizei na avaliacao!!");
        this.avaliacaoService.updateAvaliacao(this.avaliacao);
        break;
      }
    }
    if (!estouNaAvaliacao) {
      console.log("Vou entrar em algum grupo aleatório!");
      this.entrarEmGrupoAleatorio();
      this.avaliacaoService.updateAvaliacao(this.avaliacao);
    }
    return !estouNaAvaliacao || (estouNaAvaliacao && mudeiAlgo);
  }
  atualizarStatusConformeTempo() {
    setTimeout(() => {
      var agora = new Date();

      if (agora < new Date(this.avaliacao.dtInicio) || (this.avaliacao.status == 0 && this.avaliacao.isInicioIndeterminado)) {
        this.avaliacao.status = 0;
      }
      else if (agora < new Date(this.avaliacao.dtInicioCorrecao) || (this.avaliacao.status == 1 && this.avaliacao.isInicioCorrecaoIndeterminado)) {
        this.avaliacao.status = 1;
      }
      else if (agora < new Date(this.avaliacao.dtTermino) || (this.avaliacao.status == 2 && this.avaliacao.isTerminoIndeterminado)) {
        this.avaliacao.status = 2;
      }
      else {
        this.avaliacao.status = 3;
      }

      this.countDown.iniciarTimer();

      this.avaliacaoService.updateAvaliacao(this.avaliacao);
    }, 3000);

  }

  // EM PREPARAÇÃO
  addGrupo() {
    const novoLength = this.avaliacao.grupos.push({ numero: this.avaliacao.grupos.length + 1, provaId: null, alunos: [] });
    this.entrarNoGrupo(this.avaliacao.grupos[novoLength - 1]);
    setTimeout(() => {
      window.scroll({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
    }, 200);
  }
  entrarNoGrupo(grupo) {
    var me: Usuario = {
      id: this.credencialService.loggedUser.id,
      nome: this.credencialService.loggedUser.nome,
      email: this.credencialService.loggedUser.email,
      online: true,
      statusId: 0,
    };

    // Atualiza o status
    if (this.avaliacao.status == 1 && (me.statusId < 2 || me.statusId == null))
      me.statusId = 2;


    // Se o grupo já tem o máximo de integrantes
    if (grupo.alunos.length >= this.avaliacao.maxIntegrantes && this.avaliacao.limitarNumIntegrantes && this.avaliacao.tipoDisposicao != 0) {
      this.snack.open("Este grupo já está cheio", null, {
        duration: 3000
      });
      return;
    }

    // Passa por cada grupo da avaliação
    for (let g of this.avaliacao.grupos) {
      for (let aluno of g.alunos) {
        // Se estou nesse grupo, me retiro
        if (aluno.id == this.credencialService.getLoggedUserIdFromCookie()) {
          g.alunos = g.alunos.filter(a => a.id != this.credencialService.getLoggedUserIdFromCookie());
        }
      }

    }

    // Insere no grupo
    grupo.alunos.push(me);
    this.deletarGruposVazios();
    this.redefinirIdentificacaoDosGrupos();

    // Salva no bd
    this.avaliacaoService.updateAvaliacao(this.avaliacao);
  }
  temGrupoVazio() {
    return this.avaliacao.grupos.filter(g => g.alunos.length <= 0).length > 0;
  }
  entrarEmGrupoAleatorio() {
    if (this.avaliacao.tipoDisposicao == 0) {
      this.entrarNoGrupo(this.avaliacao.grupos[0]);
      return;
    }

    // Passa por cada grupo
    var foiAlocado = false;
    for (let grupo of this.avaliacao.grupos) {
      if (grupo.alunos.length < this.avaliacao.maxIntegrantes && this.avaliacao.limitarNumIntegrantes) {
        this.entrarNoGrupo(grupo);
        foiAlocado = true;
      }
    }

    // Se não consegui nenhum grupo,
    if (!foiAlocado) {
      // Cria um novo grupo
      this.addGrupo();

      // Entra nele
      this.entrarNoGrupo(this.avaliacao.grupos[this.avaliacao.grupos.length - 1]);
    }
  }
  deletarGruposVazios() {
    this.avaliacao.grupos = this.avaliacao.grupos.filter(g => g.alunos.length > 0);
  }
  redefinirIdentificacaoDosGrupos() {
    var count = 1;
    for (let grupo of this.avaliacao.grupos) {
      grupo.numero = count++;
    }
  }

  // DURANTE AVALIAÇÃO
  sinalizarFinalizacao() {


    this.getEuNaAvaliacao().statusId = 3;


    this.avaliacaoService.updateAvaliacao(this.avaliacao);
  }
  getEuNaAvaliacao(): Usuario {
    for (let grupo of this.avaliacao.grupos) {
      var count = 0;
      for (let aluno of grupo.alunos) {
        if (aluno.id == this.credencialService.getLoggedUserIdFromCookie())
          return this.avaliacao.grupos[this.avaliacao.grupos.indexOf(grupo)].alunos[count];
        count++;
      }
    }
    return null;
  }
  getEuFromAvaliacao(avaliacao: Avaliacao) {
    for (let grupo of avaliacao.grupos) {
      var count = 0;
      for (let aluno of grupo.alunos) {
        if (aluno.id == this.credencialService.getLoggedUserIdFromCookie())
          return avaliacao.grupos[avaliacao.grupos.indexOf(grupo)].alunos[count];
        count++;
      }
    }
    return null;
  }
  getEuNaProva(): Usuario {
    const EU = this.credencialService.loggedUser;
    const MEU_INDEX_PROVA = this.prova.alunos.indexOf(this.prova.alunos.filter(a => a.id == EU.id)[0]);
    return this.prova.alunos[MEU_INDEX_PROVA];
  }
  getMeuGrupoNaAvaliacao(): Grupo {
    for (let grupo of this.avaliacao.grupos) {
      for (let aluno of grupo.alunos) {
        if (aluno.id == this.credencialService.getLoggedUserIdFromCookie())
          return this.avaliacao.grupos[this.avaliacao.grupos.indexOf(grupo)];
      }
    }
    return {
      alunos: []
    }
  }
  getMeuGrupoFromAvaliacao(avaliacao: Avaliacao): Grupo {
    for (let grupo of avaliacao.grupos) {
      for (let aluno of grupo.alunos) {
        if (aluno.id == this.credencialService.getLoggedUserIdFromCookie())
          return avaliacao.grupos[avaliacao.grupos.indexOf(grupo)];
      }
    }
    return {
      alunos: []
    }
  }
  getFinalizado() {
    if (this.avaliacao.grupos.length > 0) {
      if (this.getEuNaAvaliacao())
        return this.getEuNaAvaliacao().statusId >= 3;
    }

    return false;
  }
  respostaAlterada() {
    this.provaService.updateProva(this.prova);
  }
  inserirNovaProva() {
    // Certifica-se de ter o gabarito
    if (this.gabarito.questoes.length <= 0) {
      console.log("Não tenho o gabarito!! Não vou tentar inserir prova")
      return;
    }

    if (this.estouIndoInserirProva) {
      console.log("Já estou indo atrás de inserir uma prova, não precio fazer nada");
      return;
    }
    this.estouIndoInserirProva = true;
    console.log("AVISO: estou indo inserir prova!!");


    const PROVA_EM_BRANCO = this.provaService.getProvaFromGabarito(this.gabarito);
    PROVA_EM_BRANCO.alunos = [];
    PROVA_EM_BRANCO.alunos.push(this.getEuNaAvaliacao());

    // Se já tenho prova para meu grupo, cancelo
    if (this.meuGrupoTemProva) {
      console.log("Ops, alguém já colocou uma prova para o grupo. Não vou mais tentar criar prova")
      return;
    }

    // Insere uma nova prova
    this.provaService.insertProva(PROVA_EM_BRANCO).then(novaProva => {

      console.log("Inseri no banco uma nova prova!!", novaProva.id);
      this.meuGrupoTemProva = true;

      this.prova = novaProva;
      this.getMeuGrupoNaAvaliacao().provaId = this.prova.id;
      this.getEuNaAvaliacao().statusId = 2;
      this.getEuNaProva().statusId = 2;
      this.provaService.updateProva(this.prova); // Atualizando o id de dentro da prova
      this.avaliacaoService.updateAvaliacao(this.avaliacao);

    }).catch(reason => this.comumService.notificarErro('Falha ao receber a prova', reason));




  }
  meRemoverDasQuestoes() {
    var estavaEmQuestao = false;
    for (let q of this.prova.questoes) {
      if (q.usuarioUltimaModificacao == null)
        continue;
      else if (q.usuarioUltimaModificacao.id == this.credencialService.getLoggedUserIdFromCookie()) {
        q.usuarioUltimaModificacao = null;
        estavaEmQuestao = true;
      }
    }
    if (estavaEmQuestao) {
      this.provaService.updateProva(this.prova);
    }
  }
  receberProva() {

    if ((this.prova.id != '1' && this.provaSubscription != null) || (this.avaliacao.tipoDisposicao == 0 && this.prova.id != '1')) {
      console.log("Já tenho a prova, não vou continuar");
      return;
    }


    var EU_NA_AVALIACAO = this.getEuNaAvaliacao();

    // INDIVIDUAL
    if (this.avaliacao.tipoDisposicao == 0) {

      // Se estou sem prova para fazer, pego uma prova
      if (this.getEuNaAvaliacao().provaId == null) {


        if (this.gabarito.questoes.length > 0) {

          const PROVA_EM_BRANCO = this.provaService.getProvaFromGabarito(this.gabarito);
          PROVA_EM_BRANCO.alunos = [];
          PROVA_EM_BRANCO.alunos.push(this.getEuNaAvaliacao());

          if (this.estouIndoInserirProva) {
            console.log("Já estou indo atrás de inserir uma prova, não precio fazer nada");
            return;
          }
          this.estouIndoInserirProva = true;
          console.log("AVISO: estou indo inserir prova!!");

          // Insere uma nova prova
          this.provaService.insertProva(PROVA_EM_BRANCO).then(novaProva => {
            this.prova = novaProva;
            this.getEuNaAvaliacao().provaId = this.prova.id;
            this.getEuNaAvaliacao().statusId = 2;
            this.avaliacaoService.updateAvaliacao(this.avaliacao);

          }).catch(reason => this.snack.open('Falha ao receber a prova', null, { duration: 3500 }));


        }


      }

      // Se já estou atribuido a uma prova, recebo a prova
      else {
        console.log("Já tenho uma prova atribuida à mim!")
        this.provaService.getProvaFromId(EU_NA_AVALIACAO.provaId).then(prova => {
          this.prova = prova;
          console.log("Recebi a prova")
        });
      }

    }
    // EM GRUPO
    else {


      // Se meu grupo não tem prova atribuida,              
      if (this.getMeuGrupoNaAvaliacao().provaId == null) {
        console.log("Meu grupo não tem prova ainda!");
        // Inicio um contador que vai determinar de quem é a vez de tentar criar a prova
        var count = 0;


        // Se sou o primeiro do grupo, já crio a prova
        if (this.getMeuGrupoNaAvaliacao().alunos[count].id == this.credencialService.getLoggedUserIdFromCookie()) {
          console.log("Sou o primeiro da lista de alunos do grupo, vou inserir prova!");
          this.inserirNovaProva();
        }
        // Se não sou, crio um intervalo para deixar os outros alunos criarem a prova antes de mim                
        else {
          console.log("Não sou o primeiro da lista de alunos do grupo, vou esperar um pouco");
          var intervalRef = setInterval(() => {

            // Se é minha vez de tentar criar a prova,
            if (this.getMeuGrupoNaAvaliacao().alunos[count].id == this.credencialService.getLoggedUserIdFromCookie()) {
              console.log("Está na minha vez de criar a prova!");

              // Se eu já estou com uma prova (criada por outro aluno do grupo), encerro
              if (this.getMeuGrupoNaAvaliacao().provaId != null) {
                console.log("Opa! Já estou com a prova! Tchau");
                clearInterval(intervalRef);
                return;
              }

              // Se ninguém criou a prova ainda, eu crio
              else {
                console.log("Ainda não estou com a prova... Vou criar uma nova!");
                this.inserirNovaProva();
                clearInterval(intervalRef);
              }

            }
            else {
              console.log("Ainda não é minha vez de criar a prova");
            }
            count++;

          }, 4000);

        }

      }

      // Se meu grupo já tem prova atribuida, recebe-a
      else {
        console.log("Que beleza! meu grupo já tem uma prova atribuida, vou pegar!");
        this.meuGrupoTemProva = true;



        if (this.provaSubscription == null) {

          this.provaSubscription = this.provaService.onProvaChange(this.getMeuGrupoNaAvaliacao().provaId).subscribe(prova => {

            const provaTipada = prova as Prova;

            console.log("Peguei uma prova pra mim!!", provaTipada.id);


            // Recebe a prova toda
            var provaAtualizada = { ...provaTipada };
            provaAtualizada.id = this.getMeuGrupoNaAvaliacao().provaId;

            // Atualiza as questões
            var tenhoAlgoMaisAtualizado = false;
            if (this.prova.questoes.length > 0) {
              for (var i = 0; i < provaAtualizada.questoes.length; i++) {
                if (provaAtualizada.questoes[i].ultimaModificacao < this.prova.questoes[i].ultimaModificacao) {
                  tenhoAlgoMaisAtualizado = true;
                  provaAtualizada.questoes[i] = this.prova.questoes[i];
                }
              }
            }

            this.prova = provaAtualizada;

            // Se eu não estou na prova, eu entro
            if (this.getEuNaProva() == null) {
              console.log("Eita, não to na prova!, vou me add");
              EU_NA_AVALIACAO.statusId = 2;
              this.prova.alunos.push(EU_NA_AVALIACAO);
              this.provaService.updateProva(this.prova);
              this.avaliacaoService.updateAvaliacao(this.avaliacao);
            }
            else if (tenhoAlgoMaisAtualizado) {
              console.log("Mandei atualizar de novo!", this.prova.questoes[0])
              this.provaService.updateProva(this.prova);
            }


          });

        }


      }

    }
  }



  // EM CORREÇÃO
  receberProvasCorrigir() {
    if (this.avaliacao.tipoCorrecao != 2 || this.prova.provasParaCorrigir.length > 0)
      return;

    if (this.avaliacao.correcaoParesQtdTipo == 'TODOS') {
      for (let grupo of this.avaliacao.grupos) {
        this.prova.provasParaCorrigir.push({
          id: grupo.provaId.toString(),
          corrigida: false
        });
      }
    }
    else {
      while (this.prova.provasParaCorrigir.length < this.avaliacao.correcaoParesQtdNumero) {
        for (let grupo of this.avaliacao.grupos) {
          if (Math.random() > 0.7 && this.prova.id != grupo.provaId) {
            this.prova.provasParaCorrigir.push({
              id: grupo.provaId,
              corrigida: false
            });
            if (this.prova.provasParaCorrigir.length < this.avaliacao.correcaoParesQtdNumero)
              return;
          }
        }
      }
    }
  }

  // ENCERRADA
  getMinhaNota() {
    var nota = 0;
    for (let [i, questao] of this.prova.questoes.entries()) {
      const questaoTipo = this.comumService.questaoTipos[questao.tipo];
      if (questaoTipo.temCorrecaoAutomatica)
        nota += questaoTipo.getNota(questao, this.gabarito.questoes[i]);
    }
    return nota;
  }
}
