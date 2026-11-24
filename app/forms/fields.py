from wtforms import FloatField, IntegerField


class _TypeSafe:
    """
    A JSON body can contain `null`, a list or an object where a number is
    expected. WTForms only turns bad *text* into a validation error; `float(None)`
    raises TypeError and became a 500. Treat those like any other "not a number".
    """

    def process_formdata(self, valuelist):
        try:
            super().process_formdata(valuelist)
        except TypeError:
            self.data = None
            raise ValueError(self.gettext('Not a valid number.'))


class SafeFloatField(_TypeSafe, FloatField):
    pass


class SafeIntegerField(_TypeSafe, IntegerField):
    pass
