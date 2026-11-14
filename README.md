# pixel-quasar

Un tema per Claude (app desktop e mobile): dietro la chat disegna un quasar in pixel art, con disco di accrescimento a spirale, getti e particelle in orbita, su un cielo di stelle che brillano. I colori dell'interfaccia diventano un viola-spazio scuro.

## Installazione

Al prompt di una sessione nel terminale:

```
/plugin install pixel-quasar --marketplace Boskaa/pixel-quasar-claudemod
```

Rispondi `y` per aggiungere il marketplace, poi scegli l'ambito (Invio per quello utente).

Da una shell:

```
claude plugin install pixel-quasar --marketplace Boskaa/pixel-quasar-claudemod
```

Nell'app desktop, dove `/plugin` non funziona: clicca + accanto alla casella del prompt, poi Plugins, Add marketplace con `Boskaa/pixel-quasar-claudemod`, poi Add plugin.

## Uso

Il tema si accende da solo all'avvio di ogni sessione.

- `/quasar` lo riaccende
- `/quasar off` lo spegne

## Note

- Lo sfondo viene disegnato solo dalle app desktop e mobile, non dal terminale né dagli editor.
- L'app ferma l'animazione quando l'impostazione dell'animazione dello sfondo è disattivata, quando il sistema chiede meno movimento, o quando disegna senza scheda grafica: in quei casi la scena resta visibile ma immobile.
