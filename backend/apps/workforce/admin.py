from django.contrib import admin

from .models import Maintainer, ServiceProvider

admin.site.register(Maintainer)
admin.site.register(ServiceProvider)
