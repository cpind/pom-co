
style:
	lessc --ru src/less/style.less > src/less/style.css

run:
	python mysite/manage.py runserver
