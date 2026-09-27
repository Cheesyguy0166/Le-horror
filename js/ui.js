'use strict';
// Marrow House - DOM overlays: HUD, subtitles, notes, journal, menus.
(function (MH) {
  const $ = (s) => document.querySelector(s);

  const UI = {
    init(G) {
      this.G = G;
      this.el = {
        hud: $('#hud'), cross: $('#crosshair'), obj: $('#objective'), hint: $('#hint'), prompt: $('#prompt'),
        subs: $('#subs'), battery: $('#battery'), batBar: $('#battery i'), stamina: $('#stamina'), stamBar: $('#stamina i'),
        inv: $('#inventory'), title: $('#title'), intro: $('#intro'), introText: $('#intro-text'),
        note: $('#note'), paper: $('#note .paper'), noteTitle: $('#note .note-title'), noteBody: $('#note .note-body'),
        journal: $('#journal'), jObj: $('#journal .j-obj'), jInv: $('#journal .j-inv'), jNotes: $('#journal .j-notes'),
        pause: $('#pause'), death: $('#death'), deathText: $('#death .death-text'), ending: $('#ending'), endingText: $('#ending .ending-text'),
        error: $('#error'),
      };
      this.objTimer = 0;
      this.hintTimer = 0;
      this.lastPrompt = null;
    },
    show(name, on) {
      const e = this.el[name];
      if (e) e.classList.toggle('on', on !== false);
    },
    hideScreens() {
      for (const n of ['title', 'intro', 'note', 'journal', 'pause', 'death', 'ending']) this.show(n, false);
    },
    error(msg) {
      this.el.error.querySelector('.err').textContent = msg;
      this.show('error');
    },

    // ---------- subtitles ----------
    say(text, dur, cls) {
      const line = document.createElement('span');
      line.className = 'line ' + (cls || 'me');
      line.textContent = text;
      this.el.subs.appendChild(line);
      while (this.el.subs.children.length > 3) this.el.subs.removeChild(this.el.subs.firstChild);
      const d = (dur || Math.max(2.4, text.length * 0.065)) * 1000;
      setTimeout(() => line.classList.add('out'), d);
      setTimeout(() => line.remove(), d + 700);
      return d / 1000;
    },
    clearSubs() { this.el.subs.innerHTML = ''; },

    prompt(text) {
      if (text === this.lastPrompt) return;
      this.lastPrompt = text;
      if (!text) { this.el.prompt.innerHTML = ''; this.el.cross.classList.remove('hot'); return; }
      this.el.prompt.innerHTML = '<b>E</b>' + text.replace(/</g, '&lt;');
      this.el.cross.classList.add('hot');
    },
    objective(text, quiet) {
      this.el.obj.textContent = text;
      this.objText = text;
      if (!quiet) {
        this.el.obj.classList.add('on');
        this.objTimer = 7;
      }
    },
    hint(text, dur) {
      this.el.hint.textContent = text;
      this.el.hint.classList.add('on');
      this.hintTimer = dur || 6;
    },
    update(dt, G) {
      if (this.objTimer > 0) { this.objTimer -= dt; if (this.objTimer <= 0) this.el.obj.classList.remove('on'); }
      if (this.hintTimer > 0) { this.hintTimer -= dt; if (this.hintTimer <= 0) this.el.hint.classList.remove('on'); }
      const P = G.player;
      this.el.batBar.style.width = Math.round(P.battery * 100) + '%';
      this.el.battery.classList.toggle('low', P.battery < 0.2);
      this.el.stamBar.style.width = Math.round(P.stamina * 100) + '%';
      this.el.stamina.classList.toggle('on', P.stamina < 0.98);
      const inv = [];
      if (G.inv.has('lamp')) inv.push('oil lamp');
      if (G.inv.has('bell')) inv.push("Walter's bell");
      this.el.inv.textContent = inv.length ? 'carrying: ' + inv.join(', ') : '';
    },

    // ---------- notes ----------
    showNote(note) {
      this.el.paper.className = 'paper ' + (note.style || 'hand');
      this.el.noteTitle.textContent = note.title || '';
      this.el.noteBody.innerHTML = note.html || '';
      this.el.paper.scrollTop = 0;
      this.show('note');
    },
    hideNote() { this.show('note', false); },

    showJournal(G, onRead) {
      this.el.jObj.textContent = this.objText || '';
      const inv = [];
      for (const k of G.inv) {
        const n = { key: 'spare house key', lamp: 'oil lamp (lit)', bell: "Walter's hand bell" }[k];
        if (n) inv.push(n);
      }
      this.el.jInv.textContent = inv.length ? 'Carrying: ' + inv.join(' · ') : '';
      this.el.jNotes.innerHTML = '';
      if (!G.notesRead.length) this.el.jNotes.innerHTML = '<div style="color:#6d6456;font-size:20px">Nothing yet.</div>';
      for (const id of G.notesRead) {
        const n = MH.Story.NOTES[id];
        if (!n) continue;
        const b = document.createElement('button');
        b.textContent = n.title;
        b.onclick = () => onRead(id);
        this.el.jNotes.appendChild(b);
      }
      this.show('journal');
    },

    // ---------- full screen text ----------
    typewriter(el, text, speed) {
      return new Promise((resolve) => {
        el.textContent = '';
        let i = 0;
        const tick = () => {
          if (this.skipType) { el.textContent = text; this.skipType = false; resolve(); return; }
          i++;
          el.textContent = text.slice(0, i);
          if (i < text.length) {
            const ch = text[i - 1];
            setTimeout(tick, ch === '\n' ? speed * 10 : ch === '.' ? speed * 6 : speed);
          } else resolve();
        };
        tick();
      });
    },
    death(text) {
      this.el.deathText.textContent = text;
      this.show('death');
    },
  };

  MH.UI = UI;
})(window.MH);
