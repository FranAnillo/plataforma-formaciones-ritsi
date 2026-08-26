import io

import pytest
from openpyxl import Workbook

from backend.server import (
    BoardMemberInput,
    BoardPosition,
    parse_sheet_workbook,
    parse_ritsi_universities,
    modernize_text,
    imported_source_update,
    validate_board_members,
)


def required_board():
    return [
        BoardMemberInput(user_id="1", position=BoardPosition.PRESIDENCIA),
        BoardMemberInput(user_id="2", position=BoardPosition.VICEPRESIDENCIA_POLITICA_UNIVERSITARIA),
        BoardMemberInput(user_id="3", position=BoardPosition.TESORERIA),
        BoardMemberInput(user_id="4", position=BoardPosition.SECRETARIA),
        BoardMemberInput(user_id="5", position=BoardPosition.VICEPRESIDENCIA_COMUNICACION),
    ]


def test_board_accepts_required_positions_and_two_additional_members():
    members = required_board() + [
        BoardMemberInput(user_id="6", position=BoardPosition.MIEMBRO_ADICIONAL_1),
        BoardMemberInput(user_id="7", position=BoardPosition.MIEMBRO_ADICIONAL_2),
    ]
    validate_board_members(members)


def test_board_rejects_missing_required_position():
    members = required_board()[1:] + [
        BoardMemberInput(user_id="6", position=BoardPosition.MIEMBRO_ADICIONAL_1),
    ]
    with pytest.raises(ValueError, match="Faltan cargos obligatorios"):
        validate_board_members(members)


def test_board_rejects_duplicate_person():
    members = required_board()
    members[1] = BoardMemberInput(user_id="1", position=members[1].position)
    with pytest.raises(ValueError, match="dos cargos"):
        validate_board_members(members)


def test_current_vocalia_naming_is_applied_to_historical_labels():
    assert modernize_text("Cómo sobrevivir a una Coordinación " + "Temática") == "Cómo sobrevivir a una Vocalía"
    assert modernize_text("Dinámica de Comisiones " + "Temáticas") == "Dinámica de Vocalías"
    assert modernize_text("Coordinador de la Escuela " + "de Formación") == "Vocalía de Formación"


def _workbook_with_single_resource():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "2026 - 27"
    sheet.append(["Formación", None, None, None, None, None, None, "Formador/a", None, None, None, "Información adicional"])
    sheet.append(["Código\nFormación", "Fecha", "Dirigido a", "Asistentes", "Duración\n(min)", "Valoración\n(de 1 a 5)", "Nombre", "Nombre", "Tipo", "Nombre", "Tipo", "Archivos adjuntos", None, "Etiquetas"])
    sheet.append(["FAC 001", "06/08/2026", "Vocalías", 5, 45, 4.7, "Gobernanza práctica", "Ada", "Junta Directiva", None, None, "Presentación", None, "gobernanza, RITSI"])
    sheet["L3"].hyperlink = "https://docs.google.com/presentation/d/example/edit"
    binary = io.BytesIO()
    workbook.save(binary)
    return binary.getvalue()


def test_sheet_parser_keeps_metadata_and_resource_urls():
    binary = _workbook_with_single_resource()

    items = parse_sheet_workbook(binary, "test", True)

    assert len(items) == 1
    item = items[0]
    assert item.source_code == "FAC 001"
    assert item.training_date == "2026-08-06"
    assert item.duration_minutes == 45
    assert item.trainer_names == ["Ada"]
    assert item.tags == ["gobernanza", "RITSI"]
    assert item.files[0].url == "https://docs.google.com/presentation/d/example/edit"
    assert item.files[0].file_type.value == "presentation"

    repeated = parse_sheet_workbook(binary, "another-actor", False)[0]
    assert repeated.files[0].id == item.files[0].id


def test_import_update_preserves_locally_authored_and_publication_fields():
    item = parse_sheet_workbook(_workbook_with_single_resource(), "importer", True)[0]
    item.source_document_id = "sheet-1"

    update = imported_source_update(item)

    assert update["source_document_id"] == "sheet-1"
    assert "files" in update
    assert "status" not in update
    assert "is_public" not in update
    assert "created_by" not in update
    assert "created_at" not in update
    assert "category_ids" not in update
    assert "quizzes" not in update


def test_ritsi_university_parser_keeps_membership_and_contact_data():
    markup = '''
    <div class="item"><div class="mdc-card member"><div class="mdc-card__primary-action">
      <a class="mdc-card__media mdc-card__media--16-9" href="https://uni.example/"></a>
      <h5 class="university-name"><b>Universidad de Ejemplo (UDE)</b></h5>
      <h6 class="center-name"><a href="https://center.example/"><u>Escuela de Informática</u></a></h6>
    </div></div></div>
    '''
    items = parse_ritsi_universities(14, markup)
    assert items == [{
        "name": "Universidad de Ejemplo (UDE)", "acronym": "UDE", "region": "Madrid", "zone": "II",
        "website_url": "https://uni.example/", "center_url": "https://center.example/",
        "center_name": "Escuela de Informática", "is_ritsi_member": True,
        "is_active": True,
        "source_key": "ritsi:universidad de ejemplo (ude)",
    }]
