from django import template

register = template.Library()

@register.filter
def one_error(form):
    mssg = ""
    for field in form:
        if not field.errors:
            continue
        for error in field.errors:
            mssg += field.label + ": " + error
            break
        if mssg:
            break;
    return mssg
    
@register.simple_tag
def pomco_name():
    return "Pomco"
