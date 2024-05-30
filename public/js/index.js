$(document).ready(function() {
    $('#registration').on('input', function() {
        let registration = $(this).val();
        if (registration) {
            $.ajax({
                url: '/semesters',
                type: 'POST',
                data: { registration: registration },
                success: function(response) {
                    let semesters = response.semesters;
                    let options = '';
                    semesters.forEach(function(semester) {
                        options += '<option value="' + semester + '">' + semester + '</option>';
                    });
                    $('#semester').html(options);
                }
            });
        } else {
            $('#semester').html('<option value="">Select a semester</option>');
        }
    });
});