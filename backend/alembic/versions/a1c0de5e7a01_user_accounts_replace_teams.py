"""user accounts replace teams

팀 공유 구조(teams, members, spin_rounds)를 없애고 개인 계정(users)으로 바꾼다.
- 팀 코드 9CM35L 팀의 식당은 기본 식당(restaurants.user_id NULL)으로 옮기고, 그 팀의 카테고리를 공용 카테고리로 쓴다.
- 다른 팀의 식당·카테고리, 팀원, 라운드, 기존 뽑기 기록은 지운다(되돌릴 수 없으니 실행 전 DB를 백업한다).

Revision ID: a1c0de5e7a01
Revises: bd4ee1eff48f
Create Date: 2026-10-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1c0de5e7a01'
down_revision: Union[str, Sequence[str], None] = 'bd4ee1eff48f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_TEAM_CODE = '9CM35L'
DEFAULT_CATEGORIES = ["한식", "중식", "일식", "양식", "분식", "아시안", "카페/브런치", "기타"]
ID = sa.BigInteger().with_variant(sa.Integer(), 'sqlite')


def _drop_fk_on(table: str, column: str) -> None:
    for fk in sa.inspect(op.get_bind()).get_foreign_keys(table):
        if fk['constrained_columns'] == [column]:
            op.drop_constraint(fk['name'], table, type_='foreignkey')


def _drop_indexes_on(table: str, column: str) -> None:
    # 유니크 제약도 인덱스로 함께 나오므로 인덱스 목록 하나로만 지운다.
    for ix in sa.inspect(op.get_bind()).get_indexes(table):
        if column in ix['column_names']:
            op.drop_index(ix['name'], table_name=table)


def upgrade() -> None:
    bind = op.get_bind()
    op.create_table(
        'users',
        sa.Column('id', ID, autoincrement=True, nullable=False),
        sa.Column('username', sa.String(length=20), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('nickname', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
    )

    default_team = bind.execute(sa.text("SELECT id FROM teams WHERE code = :c"), {"c": DEFAULT_TEAM_CODE}).scalar()

    # 기본 식당으로 남길 것만 두고 나머지 식당·기록·라운드·팀원을 지운다.
    op.drop_table('spin_logs')
    op.drop_table('spin_rounds')
    op.drop_table('members')
    if default_team is None:
        bind.execute(sa.text("DELETE FROM restaurants"))
        bind.execute(sa.text("DELETE FROM categories"))
    else:
        bind.execute(sa.text("DELETE FROM restaurants WHERE team_id <> :t"), {"t": default_team})
        bind.execute(sa.text("DELETE FROM categories WHERE team_id <> :t"), {"t": default_team})

    # categories: 팀 소속을 없애고 이름을 유일하게 한다.
    _drop_fk_on('categories', 'team_id')
    _drop_indexes_on('categories', 'team_id')
    op.drop_column('categories', 'team_id')
    op.create_unique_constraint('uq_categories_name', 'categories', ['name'])
    if default_team is None:
        for name in DEFAULT_CATEGORIES:
            bind.execute(sa.text("INSERT INTO categories (name) VALUES (:n)"), {"n": name})

    # restaurants: 팀 소속 대신 사용자 소속(NULL = 기본 식당)
    _drop_fk_on('restaurants', 'team_id')
    _drop_indexes_on('restaurants', 'team_id')
    op.drop_column('restaurants', 'team_id')
    op.add_column('restaurants', sa.Column('user_id', ID, nullable=True))
    op.create_foreign_key('fk_restaurants_user_id', 'restaurants', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_restaurants_user_id', 'restaurants', ['user_id'])

    op.drop_table('teams')

    op.create_table(
        'spin_logs',
        sa.Column('id', ID, autoincrement=True, nullable=False),
        sa.Column('user_id', ID, nullable=False),
        sa.Column('restaurant_id', ID, nullable=True),
        sa.Column('filter_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_spin_logs_user_id', 'spin_logs', ['user_id'])


def downgrade() -> None:
    raise NotImplementedError("팀 데이터를 지우는 마이그레이션이라 되돌릴 수 없습니다. 실행 전 백업으로 복구하세요.")
