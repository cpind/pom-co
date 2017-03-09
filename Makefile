
style:
	lessc --ru less/style.less > less/style.css

run:
	python mysite/manage.py runserver
