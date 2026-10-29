# ---------------------------------------------------------------------
#  Compilation du livre « Anglais — le grand livre d'auto-formation »
#  Usage :  make          (génère main.pdf)
#           make clean     (supprime les fichiers intermédiaires)
# ---------------------------------------------------------------------
LATEX  = pdflatex
JOB    = main
SRC    = main.tex preamble.tex frontmatter.tex $(wildcard parties/*.tex) $(wildcard annexes/*.tex)

all: $(JOB).pdf

$(JOB).pdf: $(SRC)
	$(LATEX) -interaction=nonstopmode -halt-on-error $(JOB).tex
	$(LATEX) -interaction=nonstopmode -halt-on-error $(JOB).tex

# Variante tout-en-un si latexmk est installé
latexmk:
	latexmk -pdf -interaction=nonstopmode $(JOB).tex

clean:
	rm -f *.aux *.log *.out *.toc *.lof *.lot *.fls *.fdb_latexmk *.synctex.gz
	rm -f parties/*.aux annexes/*.aux

distclean: clean
	rm -f $(JOB).pdf

.PHONY: all latexmk clean distclean
