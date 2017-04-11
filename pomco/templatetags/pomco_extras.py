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

@register.simple_tag
def disabled_if_not_logged_in(user):
    if user.is_authenticated():
        return ""
    return "disabled=True"
    
