from django.contrib import admin

from .models import Material, NfeImport, NfeUnitMapping

admin.site.register(Material)
admin.site.register(NfeImport)
admin.site.register(NfeUnitMapping)
