from django.contrib import admin

from .models import Equipment, EquipmentFamily, Location

admin.site.register(Location)
admin.site.register(EquipmentFamily)
admin.site.register(Equipment)
